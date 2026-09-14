import { Router } from 'express';
import { bookingPolicy } from '../controllers/policy.controller.js';

export const policiesRouter: Router = Router();

// Public: the figures quoted by the Booking & Hire Terms page. Changing them is
// settings administration and needs Phase 3 permissions.
policiesRouter.get('/booking', bookingPolicy);
