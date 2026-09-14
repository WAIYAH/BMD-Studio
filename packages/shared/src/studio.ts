/**
 * Public studio details for the Visit page. Internal ids, room rates and
 * turnaround buffers stay on the server.
 */

export type PublicOpeningHours =
  | { /** 0 = Sunday … 6 = Saturday. */ weekday: number; isClosed: true }
  | {
      weekday: number;
      isClosed: false;
      /** Minutes from local midnight. */
      openMinute: number;
      closeMinute: number;
    };

export interface PublicStudioRoom {
  slug: string;
  name: string;
  description: string | null;
  capacity: number;
}

export interface PublicStudio {
  slug: string;
  name: string;
  branch: string | null;
  description: string | null;
  addressLine: string | null;
  city: string | null;
  county: string | null;
  phone: string | null;
  email: string | null;
  /** Present only when both coordinates are recorded. */
  location: { latitude: number; longitude: number } | null;
  timezone: string;
  /** Monday first, as a week reads. Days without published hours are omitted. */
  hours: PublicOpeningHours[];
  /** Rooms open for use, by name. */
  rooms: PublicStudioRoom[];
}
