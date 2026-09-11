import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  API_ERROR_CODES,
  ROLES,
  type AuthSession,
  type AuthUser,
  type LoginData,
  type RegisterData,
} from '@bmd/shared';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { auditRow, type RequestContext } from '../lib/audit.js';
import { logger } from '../lib/logger.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { isUniqueViolation, prisma } from '../lib/prisma.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../lib/tokens.js';
import type { AuthenticatedUser } from '../types/express.js';

/**
 * A second refresh with an already-rotated token inside this window is treated
 * as two tabs racing, not as theft: the browser already holds the replacement
 * cookie, so the client simply retries.
 */
const ROTATION_GRACE_MS = 30_000;

const REVOKE_REASON = {
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  REUSE_DETECTED: 'reuse_detected',
  ACCOUNT_INACTIVE: 'account_inactive',
} as const;

const userWithGrants = {
  roles: {
    select: {
      role: {
        select: {
          key: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithGrants = Prisma.UserGetPayload<{ include: typeof userWithGrants }>;

export function toAuthUser(user: UserWithGrants): AuthUser {
  const roles = user.roles.map((grant) => grant.role.key).sort();
  const permissions = [
    ...new Set(
      user.roles.flatMap((grant) => grant.role.permissions.map((link) => link.permission.key)),
    ),
  ].sort();

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    roles,
    permissions,
    createdAt: user.createdAt.toISOString(),
  };
}

/** What a controller needs to answer a successful sign-in or refresh. */
export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const invalidCredentials = () =>
  new ApiError(401, API_ERROR_CODES.INVALID_CREDENTIALS, 'Email or password is incorrect.');

const sessionRevoked = () =>
  new ApiError(
    401,
    API_ERROR_CODES.SESSION_REVOKED,
    'Your session has ended. Please sign in again.',
  );

const accountInactive = () =>
  new ApiError(
    403,
    API_ERROR_CODES.ACCOUNT_INACTIVE,
    'This account is not active. Contact the studio for assistance.',
  );

async function issueSession(
  tx: Prisma.TransactionClient,
  user: UserWithGrants,
  ctx: RequestContext,
  options: { familyId?: string; refreshToken?: string } = {},
): Promise<IssuedSession> {
  const refreshToken = options.refreshToken ?? generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  const row = await tx.session.create({
    data: {
      userId: user.id,
      refreshHash: hashToken(refreshToken),
      familyId: options.familyId ?? randomUUID(),
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      ipAddress: ctx.ip ?? null,
      expiresAt: refreshExpiresAt,
    },
  });

  const accessToken = await signAccessToken({ userId: user.id, sessionId: row.id });

  return {
    refreshToken,
    refreshExpiresAt,
    session: { accessToken, expiresIn: env.accessTokenTtlSeconds, user: toAuthUser(user) },
  };
}

/**
 * Revokes every session in a family — one sign-in on one device, across all
 * of its rotations. Rows already retired by rotation are re-labelled too, which
 * is what makes access tokens minted from them stop working at once.
 */
async function revokeFamily(familyId: string, reason: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    }),
    prisma.session.updateMany({
      where: { familyId, revokedReason: REVOKE_REASON.ROTATED },
      data: { revokedReason: reason },
    }),
  ]);
}

export async function register(input: RegisterData, ctx: RequestContext): Promise<IssuedSession> {
  const customerRole = await prisma.role.findUnique({ where: { key: ROLES.CUSTOMER } });
  if (!customerRole) {
    throw ApiError.internal('The CUSTOMER role is missing. Run the database seed.');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      // Created ACTIVE: enforced email verification needs outbound mail
      // (Phase 11). `email_verified_at` stays null so that gap is visible.
      const user = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone ?? null,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          status: 'ACTIVE',
          roles: { create: { roleId: customerRole.id } },
        },
        include: userWithGrants,
      });

      const issued = await issueSession(tx, user, ctx);
      await tx.auditLog.create({
        data: auditRow(
          { action: 'auth.register', entityType: 'user', entityId: user.id, actorId: user.id },
          ctx,
        ),
      });
      return issued;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const target = JSON.stringify(
        (error as Prisma.PrismaClientKnownRequestError).meta?.target ?? '',
      );
      if (target.includes('phone')) {
        throw ApiError.conflict(
          API_ERROR_CODES.CONFLICT,
          'That phone number is already registered to another account.',
        );
      }
      throw ApiError.conflict(
        API_ERROR_CODES.EMAIL_IN_USE,
        'An account with that email address already exists.',
      );
    }
    throw error;
  }
}

export async function login(input: LoginData, ctx: RequestContext): Promise<IssuedSession> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: userWithGrants,
  });

  const passwordMatches = await verifyPassword(user?.passwordHash ?? null, input.password);
  if (!user || !passwordMatches) {
    logger.warn({ requestId: ctx.requestId }, 'Failed sign-in attempt');
    throw invalidCredentials();
  }

  // Revealed only after the correct password, so it cannot be used to probe
  // which addresses hold suspended accounts.
  if (user.status !== 'ACTIVE') throw accountInactive();

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const issued = await issueSession(tx, user, ctx);
    await tx.auditLog.create({
      data: auditRow(
        { action: 'auth.login', entityType: 'user', entityId: user.id, actorId: user.id },
        ctx,
      ),
    });
    return issued;
  });
}

export async function refresh(
  refreshToken: string | undefined,
  ctx: RequestContext,
): Promise<IssuedSession> {
  if (!refreshToken) {
    throw new ApiError(401, API_ERROR_CODES.UNAUTHENTICATED, 'There is no active session.');
  }

  const current = await prisma.session.findUnique({
    where: { refreshHash: hashToken(refreshToken) },
    include: { user: { include: userWithGrants } },
  });
  if (!current) throw sessionRevoked();

  if (current.revokedAt) {
    if (current.revokedReason === REVOKE_REASON.ROTATED) {
      if (Date.now() - current.revokedAt.getTime() <= ROTATION_GRACE_MS) {
        throw ApiError.conflict(
          API_ERROR_CODES.CONFLICT,
          'This session was just refreshed by another request. Retry.',
        );
      }
      // A retired token came back: either the legitimate client or a thief
      // holds a copy. Ending the whole family locks both out.
      await revokeFamily(current.familyId, REVOKE_REASON.REUSE_DETECTED);
      await prisma.auditLog.create({
        data: auditRow(
          {
            action: 'auth.session_reuse_detected',
            entityType: 'session',
            entityId: current.familyId,
            actorId: current.userId,
          },
          ctx,
        ),
      });
      logger.warn(
        { userId: current.userId, familyId: current.familyId, requestId: ctx.requestId },
        'Refresh token reuse detected; session family revoked',
      );
    }
    throw sessionRevoked();
  }

  if (current.expiresAt.getTime() <= Date.now()) throw sessionRevoked();

  if (current.user.status !== 'ACTIVE') {
    await revokeFamily(current.familyId, REVOKE_REASON.ACCOUNT_INACTIVE);
    throw accountInactive();
  }

  const replacement = generateRefreshToken();

  return prisma.$transaction(async (tx) => {
    // Conditional on the row still being live, so two concurrent refreshes
    // with the same token cannot both succeed.
    const retired = await tx.session.updateMany({
      where: { id: current.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: REVOKE_REASON.ROTATED,
        replacedByHash: hashToken(replacement),
      },
    });
    if (retired.count !== 1) {
      throw ApiError.conflict(
        API_ERROR_CODES.CONFLICT,
        'This session was just refreshed by another request. Retry.',
      );
    }

    return issueSession(tx, current.user, ctx, {
      familyId: current.familyId,
      refreshToken: replacement,
    });
  });
}

export async function logout(refreshToken: string | undefined, ctx: RequestContext): Promise<void> {
  if (!refreshToken) return;

  const session = await prisma.session.findUnique({
    where: { refreshHash: hashToken(refreshToken) },
    select: { familyId: true, userId: true },
  });
  if (!session) return;

  await revokeFamily(session.familyId, REVOKE_REASON.LOGOUT);
  await prisma.auditLog.create({
    data: auditRow(
      { action: 'auth.logout', entityType: 'user', entityId: session.userId, actorId: session.userId },
      ctx,
    ),
  });
}

/**
 * Resolves an access token's claims into a live principal. Returns null when
 * the session no longer backs the token; throws when the account is inactive.
 */
export async function loadPrincipal(
  sessionId: string,
  userId: string,
): Promise<AuthenticatedUser | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      revokedAt: true,
      revokedReason: true,
      expiresAt: true,
      user: { include: userWithGrants },
    },
  });

  if (!session || session.userId !== userId) return null;
  // A rotated row still backs the access tokens minted before the rotation;
  // any other revocation (logout, reuse, suspension) ends them.
  if (session.revokedAt && session.revokedReason !== REVOKE_REASON.ROTATED) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== 'ACTIVE') throw accountInactive();

  const account = toAuthUser(session.user);
  return {
    id: account.id,
    email: account.email,
    roles: account.roles,
    permissions: account.permissions,
    sessionId,
    account,
  };
}
