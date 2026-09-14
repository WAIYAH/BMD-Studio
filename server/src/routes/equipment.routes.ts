import { Router } from 'express';
import { equipmentCatalogue } from '../controllers/catalogue.controller.js';

export const equipmentRouter: Router = Router();

// Public and unauthenticated. Inventory CRUD and rentals arrive with Phase 6.
equipmentRouter.get('/catalogue', equipmentCatalogue);
