import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HealthPayload, ReadinessCheck, ReadinessPayload } from '@bmd/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function readVersion(): string {
  try {
    const pkgPath = path.resolve(here, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const version = readVersion();

export function getHealth(): HealthPayload {
  return {
    status: 'ok',
    service: 'bmd-studio-api',
    version,
    environment: env.NODE_ENV,
    timezone: env.TIMEZONE,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Dependency probe used by deployment platforms.
 *
 * Checks report `skipped` — not `up` — while a dependency has not been wired in
 * yet, so readiness never overstates what actually works.
 */
export async function getReadiness(): Promise<ReadinessPayload> {
  const checks: ReadinessCheck[] = [];

  checks.push(await checkDatabase());
  checks.push(checkStorage());

  const status = checks.some((check) => check.status === 'down') ? 'degraded' : 'ready';
  return { status, checks };
}

async function checkDatabase(): Promise<ReadinessCheck> {
  if (!env.DATABASE_URL) {
    return {
      name: 'database',
      status: 'skipped',
      detail: 'DATABASE_URL is not configured (Prisma is introduced in Phase 2).',
    };
  }

  // Phase 2 replaces this with `prisma.$queryRaw\`SELECT 1\``.
  try {
    const started = performance.now();
    // No client yet; a configured URL alone is not evidence of a live database.
    return {
      name: 'database',
      status: 'skipped',
      detail: 'Prisma client not yet installed (Phase 2).',
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    logger.error({ err: error }, 'Database readiness probe failed');
    return { name: 'database', status: 'down', detail: 'Connection failed.' };
  }
}

function checkStorage(): ReadinessCheck {
  if (!process.env.S3_BUCKET) {
    return {
      name: 'object-storage',
      status: 'skipped',
      detail: 'S3_BUCKET is not configured (media storage is introduced in Phase 9).',
    };
  }
  return {
    name: 'object-storage',
    status: 'skipped',
    detail: 'Storage client not yet installed (Phase 9).',
  };
}
