import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { API_ERROR_CODES, hasAnyPermission, type Permission } from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { loadPrincipal } from '../services/auth.service.js';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Requires a valid access token backed by a live session and an active account.
 * Roles and permissions come from the database on every request.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
  if (!token) throw ApiError.unauthenticated();

  const result = await verifyAccessToken(token);
  if (!result.ok) {
    throw result.reason === 'expired'
      ? new ApiError(401, API_ERROR_CODES.TOKEN_EXPIRED, 'Your access token has expired.')
      : ApiError.unauthenticated('The access token is invalid.');
  }

  const principal = await loadPrincipal(result.claims.sessionId, result.claims.userId);
  if (!principal) {
    throw new ApiError(
      401,
      API_ERROR_CODES.SESSION_REVOKED,
      'Your session has ended. Please sign in again.',
    );
  }

  req.user = principal;
  next();
}

/** Allows the request when the principal holds at least one of `permissions`. */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw ApiError.unauthenticated();
    if (!hasAnyPermission(req.user.permissions, permissions)) throw ApiError.forbidden();
    next();
  };
}
