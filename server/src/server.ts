import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

// All scheduling and business logic assumes the studio timezone. Pinning it
// here removes any dependence on the host machine's locale.
process.env.TZ = env.TIMEZONE;

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, timezone: env.TIMEZONE },
    `B.M.D Studio API listening on http://localhost:${env.PORT}`,
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
  // Do not let a hung connection block a deploy indefinitely.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});
