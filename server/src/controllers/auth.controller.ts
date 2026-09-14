import type { CookieOptions, Request, Response } from 'express';
import { API_ERROR_CODES, API_PREFIX, type LoginData, type RegisterData } from '@bmd/shared';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { requestContext as contextOf } from '../lib/request-context.js';
import { sendData } from '../lib/respond.js';
import * as authService from '../services/auth.service.js';

export const REFRESH_COOKIE = 'bmd_rt';

/**
 * The refresh cookie is scoped to the auth routes only, so it is never sent
 * with ordinary API traffic, and `SameSite=Strict` keeps it off cross-site
 * requests entirely.
 */
function refreshCookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: `${API_PREFIX}/auth`,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
    ...(expires ? { expires } : {}),
  };
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function sendSession(res: Response, issued: authService.IssuedSession, status: number): void {
  res.cookie(REFRESH_COOKIE, issued.refreshToken, refreshCookieOptions(issued.refreshExpiresAt));
  sendData(res, issued.session, status);
}

export async function register(req: Request, res: Response): Promise<void> {
  const issued = await authService.register(req.body as RegisterData, contextOf(req));
  sendSession(res, issued, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const issued = await authService.login(req.body as LoginData, contextOf(req));
  sendSession(res, issued, 200);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const issued = await authService.refresh(readRefreshCookie(req), contextOf(req));
    sendSession(res, issued, 200);
  } catch (error) {
    // A rotation race keeps the cookie: the browser already holds the new one.
    if (error instanceof ApiError && error.code !== API_ERROR_CODES.CONFLICT) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    }
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req), contextOf(req));
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  sendData(res, { signedOut: true });
}

export function me(req: Request, res: Response): void {
  if (!req.user) throw ApiError.unauthenticated();
  sendData(res, req.user.account);
}
