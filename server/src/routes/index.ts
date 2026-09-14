import { Router } from 'express';
import { equipmentRouter } from './equipment.routes.js';
import { healthRouter } from './health.routes.js';
import { servicesRouter } from './services.routes.js';

/**
 * Root API router. Feature routers are mounted here as each phase lands:
 *
 *   Phase 3  /auth /users /roles
 *   Phase 4  /studios /services (public /services/catalogue is live)
 *   Phase 5  /availability /bookings
 *   Phase 6  /equipment /equipment-rentals (public /equipment/catalogue is live)
 *   Phase 7  /shows
 *   Phase 8  /on-air /streams
 *   Phase 9  /media
 *   Phase 10 /payments
 *   Phase 11 /notifications
 *   Phase 13 /admin
 */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/equipment', equipmentRouter);
