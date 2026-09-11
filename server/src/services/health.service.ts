import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HealthPayload, ReadinessCheck, ReadinessPayload } from '@bmd/shared';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

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
  const started = performance.now();
  try {
    // A round trip is the only honest evidence that the database is reachable;
    // a configured URL proves nothing.
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: 'database',
      status: 'up',
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    logger.error({ err: error }, 'Database readiness probe failed');
    return {
      name: 'database',
      status: 'down',
      // The reason stays in the logs; a probe response is not the place to
      // publish connection strings or driver internals.
      detail: 'Connection failed.',
      latencyMs: Math.round(performance.now() - started),
    };
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
