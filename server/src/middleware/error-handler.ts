import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { API_ERROR_CODES, type ApiFieldError } from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { logger } from '../lib/logger.js';
import { sendError } from '../lib/respond.js';

/** 404 for any route that no router matched. */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, API_ERROR_CODES.NOT_FOUND, `Route ${req.method} ${req.path} does not exist.`);
}

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

function zodDetails(error: ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Central error handler. Nothing is swallowed: expected failures are answered
 * with their own code, and anything unexpected is logged with its stack and
 * reported to the client as a generic internal error with no internal detail.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const log = logger.child({ requestId: req.requestId, path: req.path, method: req.method });

  if (err instanceof ApiError) {
    if (err.expected) {
      log.warn({ code: err.code, statusCode: err.statusCode }, err.message);
    } else {
      log.error({ err, code: err.code }, err.message);
    }
    sendError(res, err.statusCode, err.code, err.message, {
      ...(err.details ? { details: err.details } : {}),
      requestId: req.requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    log.warn({ issues: err.issues }, 'Request failed validation');
    sendError(res, 400, API_ERROR_CODES.VALIDATION_ERROR, 'The request payload is invalid.', {
      details: zodDetails(err),
      requestId: req.requestId,
    });
    return;
  }

  // express.json() rejects malformed or oversized bodies before any handler.
  const parserError = err as BodyParserError;
  const parserStatus = parserError?.status ?? parserError?.statusCode;
  if (parserStatus === 400 && parserError?.type === 'entity.parse.failed') {
    log.warn('Malformed JSON body');
    sendError(res, 400, API_ERROR_CODES.VALIDATION_ERROR, 'The request body is not valid JSON.', {
      requestId: req.requestId,
    });
    return;
  }
  if (parserStatus === 413) {
    log.warn('Request body too large');
    sendError(res, 413, API_ERROR_CODES.PAYLOAD_TOO_LARGE, 'The request body is too large.', {
      requestId: req.requestId,
    });
    return;
  }

  log.error({ err }, 'Unhandled error');
  sendError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred.', {
    requestId: req.requestId,
  });
}
