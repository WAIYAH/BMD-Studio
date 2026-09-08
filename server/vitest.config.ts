import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
    // Integration tests share one database; running files serially avoids
    // cross-suite truncation races.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
