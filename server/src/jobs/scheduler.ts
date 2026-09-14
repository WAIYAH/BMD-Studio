import { logger } from '../lib/logger.js';
import { EXPAND_SHOWS_JOB, expandShowOccurrences } from '../services/show-occurrence.service.js';
import { runJob } from './run-job.js';

/** Four runs a day keep the 28-day horizon full with a wide margin. */
const EXPAND_SHOWS_INTERVAL_MS = 6 * 60 * 60 * 1000;

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

  expandShows();
  const timer = setInterval(expandShows, EXPAND_SHOWS_INTERVAL_MS);
  timer.unref();

  return () => clearInterval(timer);
}
