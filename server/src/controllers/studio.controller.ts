import type { Request, Response } from 'express';
import { sendData } from '../lib/respond.js';
import { getPublicStudios } from '../services/studio.service.js';

export async function publicStudios(_req: Request, res: Response): Promise<void> {
  sendData(res, await getPublicStudios());
}
