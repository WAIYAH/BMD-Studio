import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';
/** Accept an inbound id only when it is safe to echo into logs and headers. */
const SAFE_ID = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Attaches a correlation id to every request so a client-visible failure can be
 * traced to the exact server log line that produced it.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.get(HEADER);
  const id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();

  req.requestId = id;
  res.locals.requestId = id;
  res.setHeader(HEADER, id);
  next();
}
