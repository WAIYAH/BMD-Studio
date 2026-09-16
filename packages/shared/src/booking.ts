import { z } from 'zod';
import type { BookingItemKindValue, BookingStatusValue, PricingModelValue } from './domain.js';
import type { DashboardBooking, DashboardDeliverable, DashboardPayment } from './dashboard.js';
import type { Cents } from './money.js';

/**
 * Booking contracts. The server validates requests with these schemas and the
 * client builds its forms from the same objects, so the two cannot disagree.
 * Every timestamp is an ISO-8601 UTC string; every amount is integer KES cents.
 */

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, 'Not a valid identifier.');

/** A calendar date in the studio's timezone, as `YYYY-MM-DD`. */
export const studioDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');

const durationSchema = z.coerce
  .number()
  .int('Choose a whole number of minutes.')
  .min(15, 'A session is at least 15 minutes.')
  .max(24 * 60, 'A session cannot be longer than a day.');

const instantSchema = z.iso.datetime({ offset: true, error: 'Not a valid date and time.' });

export const availabilityQuerySchema = z.object({
  service: slugSchema,
  room: slugSchema,
  date: studioDateSchema,
  duration: durationSchema,
});

export type AvailabilityQuery = z.output<typeof availabilityQuerySchema>;

/** Why a whole day offers no slots. */
export const DAY_CLOSED_REASONS = [
  'CLOSED',
  'IN_THE_PAST',
  'BEYOND_BOOKING_WINDOW',
  'ROOM_UNAVAILABLE',
  'TOO_SHORT_A_DAY',
] as const;
export type DayClosedReason = (typeof DAY_CLOSED_REASONS)[number];

/** Why one slot cannot be taken. */
export const SLOT_BLOCKED_REASONS = ['BOOKED', 'BLACKOUT', 'ON_AIR', 'IN_THE_PAST'] as const;
export type SlotBlockedReason = (typeof SLOT_BLOCKED_REASONS)[number];

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  available: boolean;
  /** Null when the slot is free. */
  blockedBy: SlotBlockedReason | null;
}

export interface AvailabilityDay {
  /** The calendar date asked for, in the studio's timezone. */
  date: string;
  timezone: string;
  serviceSlug: string;
  roomSlug: string;
  durationMinutes: number;
  isOpen: boolean;
  closedReason: DayClosedReason | null;
  /** Opening and closing instants for the day, absent when closed. */
  opensAt: string | null;
  closesAt: string | null;
  slots: AvailabilitySlot[];
}

export const bookingSlotSchema = z.object({
  service: slugSchema,
  room: slugSchema,
  startsAt: instantSchema,
  durationMinutes: durationSchema,
  /** Required when the service is priced per package. */
  packageId: z.string().trim().min(1).max(64).optional(),
});

export type BookingSlotData = z.output<typeof bookingSlotSchema>;

export const createBookingSchema = bookingSlotSchema.extend({
  notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters.').optional(),
  acceptTerms: z.literal(true, {
    error: 'Accept the Booking & Hire Terms to make a booking.',
  }),
});

export type CreateBookingInput = z.input<typeof createBookingSchema>;
export type CreateBookingData = z.output<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500, 'Give a shorter reason.').optional(),
});
export type CancelBookingData = z.output<typeof cancelBookingSchema>;

export const rescheduleBookingSchema = z.object({
  room: slugSchema,
  startsAt: instantSchema,
  durationMinutes: durationSchema,
});
export type RescheduleBookingData = z.output<typeof rescheduleBookingSchema>;

export interface QuoteLine {
  kind: BookingItemKindValue;
  label: string;
  quantity: number;
  unitPriceCents: Cents;
  totalCents: Cents;
}

/**
 * A price worked out by the server. A client never computes or sends a total;
 * this is the only thing it may display.
 */
export interface BookingQuote {
  serviceSlug: string;
  serviceName: string;
  roomSlug: string;
  roomName: string;
  studioName: string;
  pricingModel: PricingModelValue;
  packageName: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  timezone: string;
  lines: QuoteLine[];
  subtotalCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  /** What must be paid to confirm the booking; equals the total when no deposit is set. */
  depositCents: Cents;
  vatPercent: number | null;
  depositPercent: number | null;
  requiresApproval: boolean;
  cancellationWindowHours: number | null;
  /** How long an unpaid booking holds its room. */
  paymentHoldMinutes: number;
  available: boolean;
  blockedBy: SlotBlockedReason | null;
}

export interface BookingItemLine extends QuoteLine {
  id: string;
}

export interface BookingStatusEvent {
  status: BookingStatusValue;
  previousStatus: BookingStatusValue | null;
  reason: string | null;
  at: string;
  /** True when the customer themselves made the change. */
  byYou: boolean;
}

export interface BookingAction {
  allowed: boolean;
  /** Why not, when `allowed` is false. */
  reason: string | null;
}

export interface BookingCancellation extends BookingAction {
  /** False once the free-cancellation window has passed. */
  free: boolean;
  freeUntil: string | null;
  /** What a free cancellation would refund, of what has been paid. */
  refundableCents: Cents;
}

export interface BookingDetail extends DashboardBooking {
  timezone: string;
  serviceSlug: string;
  roomSlug: string;
  durationMinutes: number;
  packageName: string | null;
  notes: string | null;
  subtotalCents: Cents;
  taxCents: Cents;
  depositCents: Cents;
  /** Total less everything successfully paid, never below zero. */
  balanceCents: Cents;
  /** Set only while an unpaid booking is holding its room. */
  holdExpiresAt: string | null;
  requiresApproval: boolean;
  createdAt: string;
  items: BookingItemLine[];
  history: BookingStatusEvent[];
  payments: DashboardPayment[];
  deliverables: DashboardDeliverable[];
  cancellation: BookingCancellation;
  reschedule: BookingAction;
  /** References of the bookings this one was moved from and to, when it was moved. */
  movedFromReference: string | null;
  movedToReference: string | null;
}
