import type { PublicLiveStream, PublicOnAir, PublicSchedule, PublicShow } from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Shared by the header indicator and the live page, so both read one cached answer. */
export const ON_AIR_QUERY_KEY = ['broadcast', 'on-air'] as const;

/** Active shows and the weekly slots they hold. */
export function fetchShowLineup(): Promise<PublicShow[]> {
  return api.get<PublicShow[]>('/shows');
}

/** Airings for the default window: seven days from today, studio time. */
export function fetchSchedule(): Promise<PublicSchedule> {
  return api.get<PublicSchedule>('/shows/schedule');
}

/** What an operator has put on air, and what airs next. */
export function fetchOnAir(): Promise<PublicOnAir> {
  return api.get<PublicOnAir>('/on-air');
}

/** Streams live right now, with the platforms a visitor can watch them on. */
export function fetchLiveStreams(): Promise<PublicLiveStream[]> {
  return api.get<PublicLiveStream[]>('/streams/live');
}
