import type { PublicStudio } from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Active studios with their opening hours, contact details and open rooms. */
export function fetchStudios(): Promise<PublicStudio[]> {
  return api.get<PublicStudio[]>('/studios');
}
