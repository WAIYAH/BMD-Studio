import { Router } from 'express';
import { serviceCatalogue } from '../controllers/catalogue.controller.js';

export const servicesRouter: Router = Router();

// Public and unauthenticated (plan.md §5). Staff CRUD arrives with Phase 4.
servicesRouter.get('/catalogue', serviceCatalogue);
