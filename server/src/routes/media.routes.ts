import { Router } from 'express';
import { z } from 'zod';
import { publishedGalleries, publishedGallery } from '../controllers/media.controller.js';
import { validate } from '../middleware/validate.js';

export const mediaRouter: Router = Router();

const galleryParams = z.object({ slug: z.string().min(1).max(200) });

// Public: published galleries and their public files only. Uploads and gallery
// editing need Phase 3 permissions.
mediaRouter.get('/galleries', publishedGalleries);
mediaRouter.get('/galleries/:slug', validate({ params: galleryParams }), publishedGallery);
