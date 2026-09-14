import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

// Read the developer's `.env` here so the suite can find TEST_DATABASE_URL
// before any test module — and therefore any Prisma client — is imported.
dotenv.config({ path: path.join(here, '.env'), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Integration tests run against a real PostgreSQL ' +
      'instance because the exclusion constraints are the feature under test. ' +
      'Start one with `npm run db:up` and copy server/.env.example to server/.env.',
  );
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  // The suite truncates between tests. Pointing it at the development database
  // would silently destroy a developer's data.
  throw new Error('TEST_DATABASE_URL must not be the same database as DATABASE_URL.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./tests/helpers/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Every Prisma client created inside the suite must reach the throwaway
      // database, never the development one.
      DATABASE_URL: testDatabaseUrl,
      // A fixed origin so media URL assertions do not depend on a developer's `.env`.
      MEDIA_PUBLIC_BASE_URL: 'https://media.test.invalid',
    },
    // Integration tests share one database; running files serially avoids
    // cross-suite truncation races.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
