import { logger } from '../lib/logger.js';
import { EXPIRE_HOLDS_JOB, expireBookingHolds } from '../services/booking.service.js';
import { EXPAND_SHOWS_JOB, expandShowOccurrences } from '../services/show-occurrence.service.js';
import { runJob } from './run-job.js';

/** Four runs a day keep the 28-day horizon full with a wide margin. */
const EXPAND_SHOWS_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * A held room is a room nobody else can book, so holds are swept often. The
 * sweep only ever moves a booking whose hold has already lapsed, which makes
 * running it from several instances harmless.
 */
const EXPIRE_HOLDS_INTERVAL_MS = 60 * 1000;

/**
 * Starts the in-process recurring jobs and returns a function that stops them.
 *
 * Every job here must be safe to run from several API instances at once. Show
 * expansion is: `(schedule_id, starts_at)` is unique and the room exclusion
 * constraint arbitrates any overlap inside the database.
 */
export function startScheduler(): () => void {
  const expandShows = (): void => {
    runJob(EXPAND_SHOWS_JOB, () => expandShowOccurrences())
      .then((result) => {
        const summary = {
          job: EXPAND_SHOWS_JOB,
          created: result.created,
          existing: result.existing,
        };
        if (result.conflicts.length > 0) {
          logger.warn(
            { ...summary, conflicts: result.conflicts },
            'Show airings skipped because their room is already taken',
          );
        } else {
          logger.info(summary, 'Show schedule expanded');
        }
      })
      .catch((error: unknown) =>
        logger.error({ err: error, job: EXPAND_SHOWS_JOB }, 'Show schedule expansion failed'),
      );
  };

  const expireHolds = (): void => {
    runJob(EXPIRE_HOLDS_JOB, () => expireBookingHolds())
      .then((result) => {
        if (result.expired > 0) {
          logger.info(
            { job: EXPIRE_HOLDS_JOB, expired: result.expired },
            'Released rooms held by unpaid bookings',
          );
        }
      })
      .catch((error: unknown) =>
        logger.error({ err: error, job: EXPIRE_HOLDS_JOB }, 'Booking hold sweep failed'),
      );
  };

  expandShows();
  expireHolds();

  const timers = [
    setInterval(expandShows, EXPAND_SHOWS_INTERVAL_MS),
    setInterval(expireHolds, EXPIRE_HOLDS_INTERVAL_MS),
  ];
  for (const timer of timers) timer.unref();

  return () => {
    for (const timer of timers) clearInterval(timer);
  };
}
