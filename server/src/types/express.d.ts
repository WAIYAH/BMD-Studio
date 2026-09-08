import type { Permission, Role } from '@bmd/shared';

/** The authenticated principal, attached by the auth middleware (Phase 3). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  sessionId: string;
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
