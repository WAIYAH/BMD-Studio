import type { Request, Response } from 'express';
import { sendData } from '../lib/respond.js';
import { getBookingPolicy } from '../services/policy.service.js';

export async function bookingPolicy(_req: Request, res: Response): Promise<void> {
  sendData(res, await getBookingPolicy());
}
