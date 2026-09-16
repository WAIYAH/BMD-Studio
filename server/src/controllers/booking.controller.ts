import type { Request, Response } from 'express';
import type {
  AvailabilityQuery,
  BookingSlotData,
  CancelBookingData,
  CreateBookingData,
  RescheduleBookingData,
} from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { requestContext } from '../lib/request-context.js';
import { sendData } from '../lib/respond.js';
import { getAvailability } from '../services/availability.service.js';
import * as bookings from '../services/booking.service.js';
import type { AuthenticatedUser } from '../types/express.js';

function principal(req: Request): AuthenticatedUser {
  if (!req.user) throw ApiError.unauthenticated();
  return req.user;
}

export async function availability(req: Request, res: Response): Promise<void> {
  sendData(res, await getAvailability(req.query as unknown as AvailabilityQuery));
}

export async function quote(req: Request, res: Response): Promise<void> {
  sendData(res, await bookings.quoteBooking(req.body as BookingSlotData));
}

export async function create(req: Request, res: Response): Promise<void> {
  const booking = await bookings.createBooking(
    principal(req).id,
    req.body as CreateBookingData,
    requestContext(req),
  );
  sendData(res, booking, 201);
}

export async function detail(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  sendData(res, await bookings.getBookingDetail(principal(req).id, id));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const booking = await bookings.cancelBooking(
    principal(req).id,
    id,
    req.body as CancelBookingData,
    requestContext(req),
  );
  sendData(res, booking);
}

export async function reschedule(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const booking = await bookings.rescheduleBooking(
    principal(req).id,
    id,
    req.body as RescheduleBookingData,
    requestContext(req),
  );
  sendData(res, booking);
}
