/**
 * String unions mirroring the Prisma enums, for code on both sides of the wire
 * that must not import the generated database client.
 */

export type UserStatusValue = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export type RoomStatusValue = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

export type PricingModelValue = 'HOURLY' | 'SESSION' | 'PACKAGE';

export type EquipmentConditionValue = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export type BookingStatusValue =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED';

export type RentalStatusValue =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'OVERDUE'
  | 'CANCELLED';

export type EquipmentStatusValue = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';

export type BookingItemKindValue = 'SERVICE' | 'EQUIPMENT' | 'ADDON';

export type OccurrenceStatusValue = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type StreamStatusValue = 'IDLE' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'ERROR';

export type StreamPlatformValue = 'YOUTUBE' | 'FACEBOOK' | 'CUSTOM_RTMP';

export type GalleryTypeValue = 'PHOTO' | 'VIDEO' | 'PORTFOLIO';

export type PaymentStatusValue =
  'PENDING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export type PaymentProviderValue = 'MPESA' | 'STRIPE' | 'CASH' | 'BANK';

export type PaymentPurposeValue =
  'BOOKING' | 'RENTAL' | 'DEPOSIT' | 'LATE_FEE' | 'DAMAGE' | 'OTHER';

export type JobStatusValue = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';

/** Bookings in these states hold their room (mirrors `bookings_no_overlap`). */
export const HOLDING_BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'PENDING_APPROVAL',
  'CONFIRMED',
  'IN_PROGRESS',
] as const satisfies readonly BookingStatusValue[];

/** Rentals that are still in the customer's hands or waiting on staff. */
export const OPEN_RENTAL_STATUSES = [
  'PENDING_APPROVAL',
  'APPROVED',
  'CHECKED_OUT',
  'OVERDUE',
] as const satisfies readonly RentalStatusValue[];
