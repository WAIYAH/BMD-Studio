import { PrismaClient } from '@prisma/client';
import { getPostgresCode } from '../../src/lib/prisma.js';

/**
 * A client dedicated to the test suite.
 *
 * Deliberately not the application singleton from `src/lib/prisma.ts`: tests
 * must be able to truncate and to open their own transactions without
 * interfering with the client the application code under test is using.
 */
export const testDb = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: [],
});

/**
 * Tables wiped between tests, ordered so that nothing depends on ordering:
 * `TRUNCATE ... CASCADE` in one statement handles the foreign keys itself.
 *
 * `roles`, `permissions` and `role_permissions` are excluded — they are the
 * seeded vocabulary, not test fixtures, and re-seeding them per test would
 * dominate the runtime.
 */
const FIXTURE_TABLES = [
  'audit_logs',
  'notification_outbox',
  'notification_preferences',
  'notifications',
  'payment_transactions',
  'refunds',
  'payments',
  'booking_deliverables',
  'gallery_items',
  'galleries',
  'stream_stats',
  'stream_platforms',
  'streams',
  'show_occurrences',
  'show_schedules',
  'show_hosts',
  'shows',
  'equipment_maintenance',
  'equipment_rental_items',
  'equipment_rentals',
  'equipment',
  'equipment_categories',
  'booking_status_history',
  'booking_items',
  'bookings',
  'photography_packages',
  'room_services',
  'services',
  'service_categories',
  'blackout_periods',
  'operating_hours',
  'studio_rooms',
  'studios',
  'media_files',
  'sessions',
  'password_reset_tokens',
  'email_verification_tokens',
  'user_roles',
  'users',
  'settings',
  'jobs',
] as const;

export async function truncateAll(): Promise<void> {
  const list = FIXTURE_TABLES.map((table) => `"${table}"`).join(', ');
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}

export async function disconnectTestDb(): Promise<void> {
  await testDb.$disconnect();
}

/** Postgres SQLSTATE codes asserted on directly by the constraint tests. */
export const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
} as const;

/**
 * Runs `fn` and returns the SQLSTATE it failed with, or `null` if it succeeded.
 *
 * Extraction goes through the application's own `getPostgresCode`, so these
 * tests exercise the same code path the service layer will use to turn an
 * overlap into `409 SLOT_UNAVAILABLE`. A regression in that helper fails here
 * rather than hiding behind a test-only copy of the logic.
 */
export async function sqlstateOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error: unknown) {
    const code = getPostgresCode(error);
    if (code) return code;
    throw error;
  }
}
