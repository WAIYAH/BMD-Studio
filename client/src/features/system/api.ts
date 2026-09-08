import type { HealthPayload } from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Liveness probe used by the connection panel on the home page. */
export function fetchHealth(): Promise<HealthPayload> {
  return api.get<HealthPayload>('/health');
}
