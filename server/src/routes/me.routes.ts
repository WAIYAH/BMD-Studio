import { Router } from 'express';
import { z } from 'zod';
import {
  ACCOUNT_BOOKING_SCOPES,
  ACCOUNT_RENTAL_SCOPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  NOTIFICATION_FILTERS,
  PERMISSIONS,
  cancelBookingSchema,
  cancelRentalSchema,
  createBookingSchema,
  createRentalSchema,
  notificationPreferencesSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  rescheduleBookingSchema,
} from '@bmd/shared';
import {
  cancel as cancelBooking,
  create as createBooking,
  detail as bookingDetail,
  reschedule as rescheduleBooking,
} from '../controllers/booking.controller.js';
import {
  cancel as cancelRental,
  create as createRental,
  detail as rentalDetail,
} from '../controllers/rental.controller.js';
import {
  bookings,
  changePassword,
  dashboard,
  deliverables,
  notificationPreferences,
  notifications,
  payments,
  readAllNotifications,
  readNotification,
  rentals,
  revokeSession,
  sessions,
  unreadNotificationCount,
  updateNotificationPreferences,
  updateProfile,
} from '../controllers/account.controller.js';
import { requireAuth, requirePermission } from '../middleware/authenticate.js';
import { strictRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';

export const meRouter: Router = Router();

const page = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};
const pageQuery = z.object(page);
const idParams = z.object({ id: z.string().min(1).max(64) });

// Everything here is the signed-in caller's own data: always authenticated,
// never cached by a browser or proxy.
meRouter.use(requireAuth);
meRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

meRouter.get('/dashboard', dashboard);

meRouter.get(
  '/bookings',
  validate({
    query: z.object({ scope: z.enum(ACCOUNT_BOOKING_SCOPES).default('upcoming'), ...page }),
  }),
  bookings,
);
// Making, reading and changing the caller's own bookings. The permission
// checks are the API's; the client's own guards are only cosmetic.
meRouter.post(
  '/bookings',
  requirePermission(PERMISSIONS.BOOKING_CREATE),
  validate({ body: createBookingSchema }),
  createBooking,
);
meRouter.get(
  '/bookings/:id',
  requirePermission(PERMISSIONS.BOOKING_READ_OWN),
  validate({ params: idParams }),
  bookingDetail,
);
meRouter.post(
  '/bookings/:id/cancel',
  requirePermission(PERMISSIONS.BOOKING_CANCEL_OWN),
  validate({ params: idParams, body: cancelBookingSchema }),
  cancelBooking,
);
meRouter.post(
  '/bookings/:id/reschedule',
  requirePermission(PERMISSIONS.BOOKING_UPDATE_OWN),
  validate({ params: idParams, body: rescheduleBookingSchema }),
  rescheduleBooking,
);

meRouter.get(
  '/rentals',
  validate({
    query: z.object({ scope: z.enum(ACCOUNT_RENTAL_SCOPES).default('active'), ...page }),
  }),
  rentals,
);
// Requesting, reading and cancelling the caller's own equipment hires.
meRouter.post(
  '/rentals',
  requirePermission(PERMISSIONS.RENTAL_CREATE),
  validate({ body: createRentalSchema }),
  createRental,
);
meRouter.get(
  '/rentals/:id',
  requirePermission(PERMISSIONS.RENTAL_READ_OWN),
  validate({ params: idParams }),
  rentalDetail,
);
meRouter.post(
  '/rentals/:id/cancel',
  requirePermission(PERMISSIONS.RENTAL_CANCEL_OWN),
  validate({ params: idParams, body: cancelRentalSchema }),
  cancelRental,
);

meRouter.get('/payments', validate({ query: pageQuery }), payments);
meRouter.get('/deliverables', validate({ query: pageQuery }), deliverables);

meRouter.get(
  '/notifications',
  validate({ query: z.object({ filter: z.enum(NOTIFICATION_FILTERS).default('all'), ...page }) }),
  notifications,
);
meRouter.get('/notifications/unread-count', unreadNotificationCount);
meRouter.post('/notifications/read-all', readAllNotifications);
meRouter.post('/notifications/:id/read', validate({ params: idParams }), readNotification);

meRouter.patch('/profile', validate({ body: profileUpdateSchema }), updateProfile);
// Guessing the current password is the attack this limiter blunts.
meRouter.post(
  '/password',
  strictRateLimiter,
  validate({ body: passwordChangeSchema }),
  changePassword,
);

meRouter.get('/sessions', sessions);
meRouter.delete('/sessions/:id', validate({ params: idParams }), revokeSession);

meRouter.get('/notification-preferences', notificationPreferences);
meRouter.put(
  '/notification-preferences',
  validate({ body: notificationPreferencesSchema }),
  updateNotificationPreferences,
);
