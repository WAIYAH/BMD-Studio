import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, errors, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const ISSUER = 'bmd-studio-api';
const AUDIENCE = 'bmd-studio-web';
const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

/**
 * Short-lived access token. It carries identity only — roles and permissions
 * are loaded from the database on every request, so a revoked grant or a
 * suspended account takes effect immediately rather than when the token lapses.
 */
export function signAccessToken(claims: AccessClaims): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + env.accessTokenTtlSeconds)
    .sign(secret);
}

export type AccessTokenResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: 'expired' | 'invalid' };

export async function verifyAccessToken(token: string): Promise<AccessTokenResult> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, claims: { userId: payload.sub, sessionId: payload.sid } };
  } catch (error) {
    if (error instanceof errors.JWTExpired) return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'invalid' };
  }
}

/** 256 bits of randomness; the raw value only ever lives in the httpOnly cookie. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Refresh tokens are stored as SHA-256 so a database leak cannot be replayed. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
