/**
 * Figures behind the public Booking & Hire Terms, read from the studio's
 * settings. `null` means a figure is not configured, or not valid, and the
 * terms say so instead of quoting a number.
 */
export interface PublicBookingPolicy {
  /** Hours before a session starts after which cancelling is no longer free. */
  cancellationWindowHours: number | null;
  /** How many days ahead a session can be booked. */
  maxAdvanceDays: number | null;
  /** Percentage of the booking total paid to confirm it. */
  depositPercent: number | null;
  /** Late-return charge per day, as a percentage of the item's daily rate. */
  lateFeePercentPerDay: number | null;
  vatPercent: number | null;
}
