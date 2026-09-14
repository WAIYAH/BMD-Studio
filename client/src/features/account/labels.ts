import type {
  BookingStatusValue,
  NotificationCategoryValue,
  NotificationChannelValue,
  PaymentProviderValue,
  PaymentPurposeValue,
  PaymentStatusValue,
  RentalStatusValue,
} from '@bmd/shared';
import type { StatusTone } from '@/components/ui/StatusBadge';

export interface StatusLabel {
  label: string;
  tone: StatusTone;
}

export const BOOKING_STATUS: Record<BookingStatusValue, StatusLabel> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'warning' },
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  NO_SHOW: { label: 'Missed', tone: 'danger' },
  RESCHEDULED: { label: 'Rescheduled', tone: 'neutral' },
};

/** Bookings that no longer owe anything, so no balance is shown for them. */
export const NON_BILLABLE_BOOKING: ReadonlySet<BookingStatusValue> = new Set([
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
]);

export const RENTAL_STATUS: Record<RentalStatusValue, StatusLabel> = {
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'info' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Declined', tone: 'danger' },
  CHECKED_OUT: { label: 'On hire', tone: 'success' },
  RETURNED: { label: 'Returned', tone: 'neutral' },
  OVERDUE: { label: 'Overdue', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const NON_BILLABLE_RENTAL: ReadonlySet<RentalStatusValue> = new Set([
  'PENDING_APPROVAL',
  'REJECTED',
  'CANCELLED',
]);

export const PAYMENT_STATUS: Record<PaymentStatusValue, StatusLabel> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  SUCCESSFUL: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
};

export const PAYMENT_PROVIDER: Record<PaymentProviderValue, string> = {
  MPESA: 'M-Pesa',
  STRIPE: 'Card',
  CASH: 'Cash',
  BANK: 'Bank transfer',
};

export const PAYMENT_PURPOSE: Record<PaymentPurposeValue, string> = {
  BOOKING: 'Studio booking',
  RENTAL: 'Equipment hire',
  DEPOSIT: 'Deposit',
  LATE_FEE: 'Late return fee',
  DAMAGE: 'Damage charge',
  OTHER: 'Other payment',
};

export const NOTIFICATION_CHANNEL_LABEL: Record<NotificationChannelValue, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

export const NOTIFICATION_CATEGORY_LABEL: Record<
  NotificationCategoryValue,
  { label: string; description: string }
> = {
  booking: { label: 'Bookings', description: 'Confirmations, approvals and changes to sessions.' },
  payment: { label: 'Payments', description: 'Receipts, failed payments and refunds.' },
  reminder: { label: 'Reminders', description: 'Before a session, and before a hire is due back.' },
  marketing: {
    label: 'News & offers',
    description: 'Studio news and offers. Off unless you choose.',
  },
};

/** A readable device name from a browser user agent, e.g. `Chrome on Windows`. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  // Order matters: Edge claims to be Chrome, Chrome claims to be Safari, and
  // iOS and Android also mention Mac OS X and Linux.
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';

  const system = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;

  return system ? `${browser} on ${system}` : browser;
}

export function isMobileDevice(userAgent: string | null): boolean {
  return /iPhone|iPad|iPod|Android|Mobile/.test(userAgent ?? '');
}
