/** Operating constants for the studio. Kenya-specific by design. */

/** Studio operating timezone. Kenya observes UTC+3 year round, with no DST. */
export const STUDIO_TIMEZONE = 'Africa/Nairobi' as const;

/** ISO-4217 currency for all pricing. */
export const CURRENCY = 'KES' as const;

/**
 * Every monetary amount in this system is an integer number of cents so that
 * arithmetic is exact. 1 KES = 100 cents.
 */
export const CENTS_PER_UNIT = 100 as const;

/** API version prefix, shared by the server router and the client base URL. */
export const API_PREFIX = '/api/v1' as const;

export const DEFAULT_PAGE_SIZE = 20 as const;
export const MAX_PAGE_SIZE = 100 as const;
