import type { AuthUser } from '@bmd/shared';

/** The authenticated principal, attached by `requireAuth`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  /** Role keys, loaded from the database on this request. */
  roles: string[];
  /** Effective permissions, loaded from the database on this request. */
  permissions: string[];
  sessionId: string;
  /** The same principal in its client-facing shape. */
  account: AuthUser;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
    }
  }
}

export {};
