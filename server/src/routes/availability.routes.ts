import { Router } from 'express';
import { availabilityQuerySchema } from '@bmd/shared';
import { availability } from '../controllers/booking.controller.js';
import { validate } from '../middleware/validate.js';

export const availabilityRouter: Router = Router();

// Public: a visitor compares times before they have an account. Slots change
// by the minute, so nothing here may be cached.
availabilityRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

availabilityRouter.get('/', validate({ query: availabilityQuerySchema }), availability);
