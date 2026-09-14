import { z } from 'zod';

/**
 * Contracts for the signed-in customer area (`/api/v1/me`). Timestamps are
 * ISO-8601 UTC strings.
 */

export const ACCOUNT_BOOKING_SCOPES = ['upcoming', 'past'] as const;
export type AccountBookingScope = (typeof ACCOUNT_BOOKING_SCOPES)[number];

export const ACCOUNT_RENTAL_SCOPES = ['active', 'past'] as const;
export type AccountRentalScope = (typeof ACCOUNT_RENTAL_SCOPES)[number];

export const NOTIFICATION_FILTERS = ['all', 'unread'] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

/**
 * One signed-in device. `id` is the session family — a single sign-in across
 * all of its token rotations — so ending it signs that device out for good.
 */
export interface AccountSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  signedInAt: string;
  /** When the device last renewed its session. */
  lastActiveAt: string;
  expiresAt: string;
  /** The device making this request. */
  current: boolean;
}

export const NOTIFICATION_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const;
export type NotificationChannelValue = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CATEGORIES = ['booking', 'payment', 'reminder', 'marketing'] as const;
export type NotificationCategoryValue = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreference {
  channel: NotificationChannelValue;
  category: NotificationCategoryValue;
  enabled: boolean;
}

/**
 * The setting used until a customer makes a choice. Marketing is opt-in, as the
 * Privacy Policy promises: it stays off until the customer turns it on.
 */
export function defaultNotificationPreference(category: NotificationCategoryValue): boolean {
  return category !== 'marketing';
}

export const notificationPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        channel: z.enum(NOTIFICATION_CHANNELS),
        category: z.enum(NOTIFICATION_CATEGORIES),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(NOTIFICATION_CHANNELS.length * NOTIFICATION_CATEGORIES.length),
});

export type NotificationPreferencesData = z.output<typeof notificationPreferencesSchema>;
