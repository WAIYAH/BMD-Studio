import type {
  AvailabilityDay,
  BookingDetail,
  BookingQuote,
  BookingSlotData,
  CancelBookingData,
  CreateBookingData,
  RescheduleBookingData,
} from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Slots for one room on one day. Public: a visitor compares times before signing up. */
export function fetchAvailability(params: {
  service: string;
  room: string;
  date: string;
  duration: number;
}): Promise<AvailabilityDay> {
  return api.get<AvailabilityDay>('/availability', { params });
}

/** The server's price for a slot. The client never computes a total of its own. */
export function fetchQuote(input: BookingSlotData): Promise<BookingQuote> {
  return api.post<BookingQuote>('/bookings/quote', input);
}

export function createBooking(input: CreateBookingData): Promise<BookingDetail> {
  return api.post<BookingDetail>('/me/bookings', input);
}

export function fetchBooking(id: string): Promise<BookingDetail> {
  return api.get<BookingDetail>(`/me/bookings/${encodeURIComponent(id)}`);
}

export function cancelBooking(id: string, data: CancelBookingData): Promise<BookingDetail> {
  return api.post<BookingDetail>(`/me/bookings/${encodeURIComponent(id)}/cancel`, data);
}

export function rescheduleBooking(id: string, data: RescheduleBookingData): Promise<BookingDetail> {
  return api.post<BookingDetail>(`/me/bookings/${encodeURIComponent(id)}/reschedule`, data);
}
