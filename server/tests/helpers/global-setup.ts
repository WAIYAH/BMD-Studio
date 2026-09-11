import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '../..');
const require = createRequire(import.meta.url);

/**
 * Absolute path to the Prisma CLI's JavaScript entrypoint.
 *
 * Resolved from the installed package's `bin` field and run under the current
 * Node binary, rather than shelling out to `npx`. Windows refuses to spawn a
 * `.cmd` shim without a shell, and spawning through a shell would concatenate
 * the arguments into a command line instead of passing them as a vector.
 */
function resolvePrismaCli(): string {
  const manifestPath = require.resolve('prisma/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.prisma;
  if (!bin) throw new Error('Could not locate the Prisma CLI entrypoint.');
  return path.join(path.dirname(manifestPath), bin);
}

/**
 * Brings the throwaway test database up to the current migration history once,
 * before any suite runs.
 *
 * `migrate deploy` rather than `migrate dev`: it applies the committed
 * migrations exactly as production would, so the hand-written exclusion
 * constraints are exercised by the same SQL that will ship. It never generates
 * a migration and never prompts.
 */
export default function setup(): void {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_DATABASE_URL is not set.');

  try {
    execFileSync(process.execPath, [resolvePrismaCli(), 'migrate', 'deploy'], {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
  } catch (error) {
    // execFileSync's own message says only that the command failed; the useful
    // detail is whatever Prisma wrote before exiting.
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    const detail = [output.stdout?.toString(), output.stderr?.toString()]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `Failed to migrate the test database. Is PostgreSQL running (\`npm run db:up\`)?\n${detail}`,
      { cause: error },
    );
  }
}
