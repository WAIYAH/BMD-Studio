import type { Request } from 'express';
import type { RequestContext } from './audit.js';

/** Who made a request and from where, as recorded on audit rows and sessions. */
export function requestContext(req: Request): RequestContext {
  return { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.requestId };
}
