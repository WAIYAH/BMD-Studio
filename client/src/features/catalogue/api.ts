import type { PublicEquipmentCategory, PublicServiceCategory } from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Bookable services, grouped by category, exactly as configured by staff. */
export function fetchServiceCatalogue(): Promise<PublicServiceCategory[]> {
  return api.get<PublicServiceCategory[]>('/services/catalogue');
}

/** Hire equipment grouped into products, with live shelf availability. */
export function fetchEquipmentCatalogue(): Promise<PublicEquipmentCategory[]> {
  return api.get<PublicEquipmentCategory[]>('/equipment/catalogue');
}
