import type { PublicBookingPolicy } from '@bmd/shared';
import { api } from '@/lib/api-client';

/** The deposit, cancellation, late-fee and VAT figures the booking terms quote. */
export function fetchBookingPolicy(): Promise<PublicBookingPolicy> {
  return api.get<PublicBookingPolicy>('/policies/booking');
}
