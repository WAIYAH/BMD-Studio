import { API_ERROR_CODES, type ApiErrorCode, type ApiFieldError } from '@bmd/shared';

/**
 * The only error type controllers and services should throw for expected
 * failures. Anything else that reaches the error handler is treated as an
 * unexpected fault: logged in full, reported to the client as INTERNAL_ERROR
 * with no internal detail.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: ApiFieldError[];
  /** Set to false for faults worth alerting on. */
  readonly expected: boolean;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    options: { details?: ApiFieldError[]; cause?: unknown; expected?: boolean } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (options.details) this.details = options.details;
    this.expected = options.expected ?? true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: ApiFieldError[]): ApiError {
    return new ApiError(400, API_ERROR_CODES.VALIDATION_ERROR, message, { details });
  }

  static unauthenticated(message = 'Authentication is required.'): ApiError {
    return new ApiError(401, API_ERROR_CODES.UNAUTHENTICATED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action.'): ApiError {
    return new ApiError(403, API_ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource'): ApiError {
    return new ApiError(404, API_ERROR_CODES.NOT_FOUND, `${resource} was not found.`);
  }

  static conflict(code: ApiErrorCode, message: string): ApiError {
    return new ApiError(409, code, message);
  }

  static internal(message = 'An unexpected error occurred.', cause?: unknown): ApiError {
    return new ApiError(500, API_ERROR_CODES.INTERNAL_ERROR, message, {
      cause,
      expected: false,
    });
  }
}
