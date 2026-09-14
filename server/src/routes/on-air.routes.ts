import { Router } from 'express';
import { onAir } from '../controllers/broadcast.controller.js';

export const onAirRouter: Router = Router();

// Public. Starting and ending an airing is the ON-AIR control panel's job and
// needs Phase 3 permissions.
onAirRouter.get('/', onAir);
