import type { OccurrenceStatusValue, StreamPlatformValue } from './domain.js';

/**
 * Public broadcast payloads: the programme schedule, what is on air and which
 * streams are live. Deliberately narrower than the database rows — host
 * accounts, rooms, RTMP ingest URLs and provider broadcast ids never appear.
 */

/** Widest window `GET /shows/schedule` serves in one request. */
export const SCHEDULE_MAX_DAYS = 31;

/** Window served when the caller names no range. */
export const SCHEDULE_DEFAULT_DAYS = 7;

/** How a platform is named to a viewer, e.g. "Watch on YouTube". */
export const STREAM_PLATFORM_LABEL: Record<StreamPlatformValue, string> = {
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  CUSTOM_RTMP: 'the studio player',
};

/** A weekly slot in the line-up, as wall-clock times in the studio timezone. */
export interface PublicShowSlot {
  /** 0 = Sunday … 6 = Saturday, ascending. */
  weekdays: number[];
  /** Minutes from local midnight. */
  startMinute: number;
  endMinute: number;
}

export interface PublicShow {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  /** Rules in effect today. Empty when the show holds no current slot. */
  slots: PublicShowSlot[];
}

/** One concrete airing. Cancelled airings are never published. */
export interface PublicAiring {
  id: string;
  showSlug: string;
  showName: string;
  /** Episode title, when staff set one. */
  title: string | null;
  category: string | null;
  startsAt: string;
  endsAt: string;
  status: OccurrenceStatusValue;
}

export interface PublicSchedule {
  /** IANA zone the studio's wall-clock times belong to. */
  timezone: string;
  from: string;
  to: string;
  airings: PublicAiring[];
}

export interface PublicOnAirAiring extends PublicAiring {
  wentLiveAt: string | null;
}

export interface PublicOnAir {
  timezone: string;
  /**
   * The airing an operator has put on air. Never inferred from the clock: an
   * airing whose slot covers now but that nobody started is not on air.
   */
  current: PublicOnAirAiring | null;
  /** The soonest scheduled airing that has not started yet. */
  next: PublicAiring | null;
}

export interface PublicStreamPlatform {
  platform: StreamPlatformValue;
  /** An http(s) link to the provider's watch page. */
  watchUrl: string | null;
  /** A provider player URL on an allowlisted host, safe to frame. */
  embedUrl: string | null;
}

export interface PublicLiveStream {
  id: string;
  title: string;
  description: string | null;
  showName: string | null;
  startedAt: string | null;
  /** Never empty: a stream nobody can watch is not listed. */
  platforms: PublicStreamPlatform[];
}
