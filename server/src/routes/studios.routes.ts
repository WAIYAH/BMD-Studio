import { Router } from 'express';
import { publicStudios } from '../controllers/studio.controller.js';

export const studiosRouter: Router = Router();

// Public: active studios, opening hours and open rooms. Studio, hours and
// blackout editing needs Phase 3 permissions.
studiosRouter.get('/', publicStudios);
