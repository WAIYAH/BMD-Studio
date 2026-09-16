import { Router } from 'express';
import { bookingSlotSchema } from '@bmd/shared';
import { quote } from '../controllers/booking.controller.js';
import { validate } from '../middleware/validate.js';

export const bookingsRouter: Router = Router();

/**
 * Quoting is public, so a visitor sees the real price before signing up. The
 * price is computed here and nowhere else; creating the booking recomputes it
 * rather than trusting anything quoted earlier.
 */
bookingsRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

bookingsRouter.post('/quote', validate({ body: bookingSlotSchema }), quote);
