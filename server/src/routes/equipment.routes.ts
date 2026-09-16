import { Router } from 'express';
import { hireQuoteSchema, hireWindowSchema } from '@bmd/shared';
import { equipmentCatalogue } from '../controllers/catalogue.controller.js';
import { equipmentAvailability, hireQuote } from '../controllers/rental.controller.js';
import { validate } from '../middleware/validate.js';

export const equipmentRouter: Router = Router();

// Public and unauthenticated. Requesting a hire needs an account and lives
// under /me/rentals; inventory management arrives with the admin area.
equipmentRouter.get('/catalogue', equipmentCatalogue);

// What is free, and what it would cost, change as hires are made, so neither
// answer may be cached.
equipmentRouter.get(
  '/availability',
  validate({ query: hireWindowSchema }),
  (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  equipmentAvailability,
);

equipmentRouter.post(
  '/hire-quote',
  validate({ body: hireQuoteSchema }),
  (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  hireQuote,
);
