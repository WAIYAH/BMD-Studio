import { z } from 'zod';
import { studioDateSchema, type BookingCancellation } from './booking.js';
import type { DashboardPayment, DashboardRental } from './dashboard.js';
import type { Cents } from './money.js';

/**
 * Equipment hire contracts.
 *
 * Equipment goes out and comes back in opening hours, so a hire is measured in
 * whole studio days: out on the first day, back on the last. Products are the
 * grouped listings a customer chooses from on the hire catalogue, not the
 * individual units — which unit goes out is the studio's business.
 */

const productKeySchema = z.string().trim().min(1).max(160);

const quantitySchema = z.coerce
  .number()
  .int('Choose a whole number of items.')
  .min(1, 'Choose at least one.')
  .max(20, 'For more than 20 of one item, contact the studio.');

export const hireWindowSchema = z
  .object({ from: studioDateSchema, to: studioDateSchema })
  .refine((value) => value.to >= value.from, {
    error: 'The return date cannot be before the collection date.',
    path: ['to'],
  });

export const hireItemSchema = z.object({
  key: productKeySchema,
  quantity: quantitySchema,
});

export const hireQuoteSchema = z.object({
  from: studioDateSchema,
  to: studioDateSchema,
  items: z.array(hireItemSchema).min(1, 'Choose at least one item.').max(20),
});

export type HireQuoteData = z.output<typeof hireQuoteSchema>;

export const createRentalSchema = hireQuoteSchema.extend({
  notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters.').optional(),
  acceptTerms: z.literal(true, {
    error: 'Accept the Booking & Hire Terms to request a hire.',
  }),
});

export type CreateRentalData = z.output<typeof createRentalSchema>;

export const cancelRentalSchema = z.object({
  reason: z.string().trim().max(500, 'Give a shorter reason.').optional(),
});
export type CancelRentalData = z.output<typeof cancelRentalSchema>;

/** How many units of one product are free across a whole hire window. */
export interface EquipmentAvailabilityItem {
  key: string;
  name: string;
  /** Units in the fleet, excluding retired stock. */
  unitCount: number;
  /** Units free for every day of the window. */
  availableCount: number;
  dailyRateCents: Cents;
  depositCents: Cents;
}

export interface EquipmentAvailability {
  from: string;
  to: string;
  /** Whole studio days charged, counting both the first and the last. */
  days: number;
  timezone: string;
  /** Set when the studio is closed on a collection or return day. */
  closedOn: string[];
  items: EquipmentAvailabilityItem[];
}

export interface HireQuoteLine {
  key: string;
  label: string;
  quantity: number;
  /** Units actually free for the window; below `quantity` when stock is short. */
  availableCount: number;
  dailyRateCents: Cents;
  /** Rate × days × quantity. */
  totalCents: Cents;
  /** Refundable, held while the equipment is out. */
  depositCents: Cents;
}

export interface HireQuote {
  from: string;
  to: string;
  days: number;
  timezone: string;
  lines: HireQuoteLine[];
  subtotalCents: Cents;
  taxCents: Cents;
  /** Total of the refundable deposits on the lines. */
  depositCents: Cents;
  totalCents: Cents;
  vatPercent: number | null;
  /** False when any line cannot be filled, or the studio is closed that day. */
  available: boolean;
  /** Product keys that cannot be filled for this window. */
  unavailableKeys: string[];
  closedOn: string[];
}

export interface RentalItemLine {
  key: string;
  name: string;
  quantity: number;
  dailyRateCents: Cents;
  totalCents: Cents;
  depositCents: Cents;
}

export interface RentalDetail extends DashboardRental {
  timezone: string;
  days: number;
  notes: string | null;
  subtotalCents: Cents;
  taxCents: Cents;
  depositCents: Cents;
  lateFeeCents: Cents;
  damageFeeCents: Cents;
  /** Total less everything successfully paid, never below zero. */
  balanceCents: Cents;
  createdAt: string;
  approvedAt: string | null;
  rejectedReason: string | null;
  checkedOutAt: string | null;
  returnedAt: string | null;
  lines: RentalItemLine[];
  payments: DashboardPayment[];
  cancellation: BookingCancellation;
}
