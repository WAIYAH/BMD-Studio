import type { Request, Response } from 'express';
import { sendData } from '../lib/respond.js';
import {
  getLiveStreams,
  getOnAir,
  getSchedule,
  getShowLineup,
  resolveScheduleWindow,
} from '../services/broadcast.service.js';

export async function showLineup(_req: Request, res: Response): Promise<void> {
  sendData(res, await getShowLineup());
}

export async function showSchedule(req: Request, res: Response): Promise<void> {
  const query = req.query as { from?: string; to?: string };
  sendData(res, await getSchedule(resolveScheduleWindow(query)));
}

export async function onAir(_req: Request, res: Response): Promise<void> {
  sendData(res, await getOnAir());
}

export async function liveStreams(_req: Request, res: Response): Promise<void> {
  sendData(res, await getLiveStreams());
}
