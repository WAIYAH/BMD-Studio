import rateLimit, { type Options } from 'express-rate-limit';
import { API_ERROR_CODES } from '@bmd/shared';
import { env } from '../config/env.js';
import { sendError } from '../lib/respond.js';

const shared: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Rate limiting is a defence, not a test obstacle.
  skip: () => env.isTest,
  handler: (req, res) => {
    sendError(res, 429, API_ERROR_CODES.RATE_LIMITED, 'Too many requests. Please slow down.', {
      requestId: req.requestId,
    });
  },
};

/** Broad protection applied to the whole API surface. */
export const globalRateLimiter = rateLimit({
  ...shared,
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_MAX,
});

/**
 * Strict limiter for credential and payment endpoints, where the cost of abuse
 * is account takeover or money movement rather than load.
 */
export const strictRateLimiter = rateLimit({
  ...shared,
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
});
