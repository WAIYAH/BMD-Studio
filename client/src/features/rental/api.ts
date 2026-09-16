import type {
  CancelRentalData,
  CreateRentalData,
  EquipmentAvailability,
  HireQuote,
  HireQuoteData,
  RentalDetail,
} from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Units free across a whole hire window. Public, like the catalogue itself. */
export function fetchEquipmentAvailability(params: {
  from: string;
  to: string;
}): Promise<EquipmentAvailability> {
  return api.get<EquipmentAvailability>('/equipment/availability', { params });
}

/** The server's price for a hire. The client never totals anything itself. */
export function fetchHireQuote(data: HireQuoteData): Promise<HireQuote> {
  return api.post<HireQuote>('/equipment/hire-quote', data);
}

export function createRental(data: CreateRentalData): Promise<RentalDetail> {
  return api.post<RentalDetail>('/me/rentals', data);
}

export function fetchRental(id: string): Promise<RentalDetail> {
  return api.get<RentalDetail>(`/me/rentals/${encodeURIComponent(id)}`);
}

export function cancelRental(id: string, data: CancelRentalData): Promise<RentalDetail> {
  return api.post<RentalDetail>(`/me/rentals/${encodeURIComponent(id)}/cancel`, data);
}
