import { Router } from 'express';
import { loginSchema, registerSchema } from '@bmd/shared';
import { login, logout, me, refresh, register } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/authenticate.js';
import { strictRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';

export const authRouter: Router = Router();

// Credentials and tokens must never be cached by a browser or proxy.
authRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

authRouter.post('/register', strictRateLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', strictRateLimiter, validate({ body: loginSchema }), login);
// Refresh runs on every page load and ahead of each token expiry, so it stays
// under the global limiter; a stolen cookie is contained by rotation instead.
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
