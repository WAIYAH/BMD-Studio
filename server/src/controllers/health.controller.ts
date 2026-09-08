import type { Request, Response } from 'express';
import { sendData } from '../lib/respond.js';
import { getHealth, getReadiness } from '../services/health.service.js';

export function health(_req: Request, res: Response): void {
  sendData(res, getHealth());
}

export async function readiness(_req: Request, res: Response): Promise<void> {
  const payload = await getReadiness();
  // A degraded service must not report 200 to an orchestrator's probe.
  sendData(res, payload, payload.status === 'ready' ? 200 : 503);
}
