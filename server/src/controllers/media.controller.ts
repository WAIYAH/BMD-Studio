import type { Request, Response } from 'express';
import { sendData } from '../lib/respond.js';
import { getPublishedGallery, listPublishedGalleries } from '../services/gallery.service.js';

export async function publishedGalleries(_req: Request, res: Response): Promise<void> {
  sendData(res, await listPublishedGalleries());
}

export async function publishedGallery(req: Request, res: Response): Promise<void> {
  const { slug } = req.params as { slug: string };
  sendData(res, await getPublishedGallery(slug));
}
