import { Router } from 'express';
import { health, readiness } from '../controllers/health.controller.js';

export const healthRouter: Router = Router();

healthRouter.get('/', health);
healthRouter.get('/ready', readiness);
