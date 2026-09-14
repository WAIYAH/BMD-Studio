import { Router } from 'express';
import { z } from 'zod';
import { showLineup, showSchedule } from '../controllers/broadcast.controller.js';
import { validate } from '../middleware/validate.js';

export const showsRouter: Router = Router();

const scheduleQuery = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

// Public and unauthenticated (plan.md §5). Show, host and schedule editing
// needs Phase 3 permissions.
showsRouter.get('/', showLineup);
showsRouter.get('/schedule', validate({ query: scheduleQuery }), showSchedule);
