import { Router } from 'express';
import { equipmentRouter } from './equipment.routes.js';
import { healthRouter } from './health.routes.js';
import { mediaRouter } from './media.routes.js';
import { onAirRouter } from './on-air.routes.js';
import { servicesRouter } from './services.routes.js';
import { showsRouter } from './shows.routes.js';
import { streamsRouter } from './streams.routes.js';
import { studiosRouter } from './studios.routes.js';

/**
 * Root API router. Feature routers are mounted here as each phase lands:
 *
 *   Phase 3  /auth /users /roles
 *   Phase 4  /studios /services (public /studios and /services/catalogue are live)
 *   Phase 5  /availability /bookings
 *   Phase 6  /equipment /equipment-rentals (public /equipment/catalogue is live)
 *   Phase 7  /shows (public line-up and /shows/schedule are live)
 *   Phase 8  /on-air /streams (public /on-air and /streams/live are live)
 *   Phase 9  /media (public /media/galleries is live)
 *   Phase 10 /payments
 *   Phase 11 /notifications
 *   Phase 13 /admin
 */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/studios', studiosRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/equipment', equipmentRouter);
apiRouter.use('/shows', showsRouter);
apiRouter.use('/on-air', onAirRouter);
apiRouter.use('/streams', streamsRouter);
apiRouter.use('/media', mediaRouter);
