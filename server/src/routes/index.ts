import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { availabilityRouter } from './availability.routes.js';
import { bookingsRouter } from './bookings.routes.js';
import { equipmentRouter } from './equipment.routes.js';
import { healthRouter } from './health.routes.js';
import { meRouter } from './me.routes.js';
import { mediaRouter } from './media.routes.js';
import { onAirRouter } from './on-air.routes.js';
import { policiesRouter } from './policies.routes.js';
import { servicesRouter } from './services.routes.js';
import { showsRouter } from './shows.routes.js';
import { streamsRouter } from './streams.routes.js';
import { studiosRouter } from './studios.routes.js';

/**
 * Root API router. Feature routers are mounted here as each phase lands:
 *
 *   Phase 3  /auth and /me (customer area) are live; /users /roles to come
 *   Phase 4  /studios /services (public /studios and /services/catalogue are live)
 *   Phase 5  /availability and /bookings/quote are live; customer bookings
 *            live under /me/bookings
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
apiRouter.use('/auth', authRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/availability', availabilityRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/studios', studiosRouter);
apiRouter.use('/policies', policiesRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/equipment', equipmentRouter);
apiRouter.use('/shows', showsRouter);
apiRouter.use('/on-air', onAirRouter);
apiRouter.use('/streams', streamsRouter);
apiRouter.use('/media', mediaRouter);
