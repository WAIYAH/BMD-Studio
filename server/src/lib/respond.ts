import type { Response } from 'express';
import {
  DEFAULT_PAGE_SIZE,
  type ApiFailure,
  type ApiFieldError,
  type ApiErrorCode,
  type ApiSuccess,
  type PaginationMeta,
} from '@bmd/shared';

/** Sends the success envelope. Every controller returns through here. */
export function sendData<T>(res: Response, data: T, status = 200): Response {
  const body: ApiSuccess<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; pageSize: number; total: number },
  status = 200,
): Response {
  const pageSize = meta.pageSize || DEFAULT_PAGE_SIZE;
  const pagination: PaginationMeta = {
    page: meta.page,
    pageSize,
    total: meta.total,
    totalPages: Math.max(1, Math.ceil(meta.total / pageSize)),
  };
  const body: ApiSuccess<T[]> = { success: true, data, meta: pagination };
  return res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  options: { details?: ApiFieldError[]; requestId?: string } = {},
): Response {
  const body: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      ...(options.details ? { details: options.details } : {}),
    },
    requestId: options.requestId ?? res.locals.requestId ?? 'unknown',
  };
  return res.status(status).json(body);
}
