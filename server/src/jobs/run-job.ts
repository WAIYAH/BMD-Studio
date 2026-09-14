import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const MAX_ERROR_LENGTH = 2000;

/**
 * Runs `task` under the `jobs` bookkeeping row called `name`, so operators can
 * see when a recurring job last ran and how it ended. The task's own result or
 * error passes through unchanged.
 */
export async function runJob<T>(name: string, task: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  await prisma.job.upsert({
    where: { name },
    create: { name, status: 'RUNNING', lastRunAt: startedAt },
    update: { status: 'RUNNING', lastRunAt: startedAt },
  });

  try {
    const result = await task();
    await prisma.job.update({
      where: { name },
      data: {
        status: 'SUCCESS',
        lastEndedAt: new Date(),
        lastError: null,
        runCount: { increment: 1 },
      },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.job
      .update({
        where: { name },
        data: {
          status: 'FAILED',
          lastEndedAt: new Date(),
          lastError: message.slice(0, MAX_ERROR_LENGTH),
          runCount: { increment: 1 },
        },
      })
      // Losing the bookkeeping must not mask the failure that caused it.
      .catch((bookkeepingError: unknown) =>
        logger.error({ err: bookkeepingError, job: name }, 'Could not record job failure'),
      );
    throw error;
  }
}
