import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { API_ERROR_CODES } from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and replaces `req.body` / `req.query` / `req.params` with parsed,
 * typed values. Handlers downstream therefore never see unvalidated input.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Record<string, string>;
      }
      if (schemas.query) {
        // Express 5 exposes req.query via a getter, so assign onto the object.
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'The request payload is invalid.', {
            details: error.issues.map((issue) => ({
              path: issue.path.join('.') || '(root)',
              message: issue.message,
            })),
          }),
        );
        return;
      }
      next(error);
    }
  };
}

/** Convenience type for handlers written against a validated body schema. */
export type Validated<S extends ZodTypeAny> = z.infer<S>;
