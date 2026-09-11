import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * PostgreSQL error codes this application reacts to by name rather than by
 * parsing messages.
 *
 * `EXCLUSION_VIOLATION` is the one that matters most: it is how the database
 * reports that a booking, rental or airing would have overlapped an existing
 * one (plan.md §4.2). The service layer turns it into `409 SLOT_UNAVAILABLE`.
 */
export const PG_ERROR = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
} as const;

/** True when `error` is the database refusing an overlapping period. */
export function isExclusionViolation(error: unknown): boolean {
  return getPostgresCode(error) === PG_ERROR.EXCLUSION_VIOLATION;
}

export function isUniqueViolation(error: unknown): boolean {
  return getPostgresCode(error) === PG_ERROR.UNIQUE_VIOLATION;
}

export function isCheckViolation(error: unknown): boolean {
  return getPostgresCode(error) === PG_ERROR.CHECK_VIOLATION;
}

/**
 * Prisma recognises a handful of integrity errors, translates them into its own
 * `P####` codes and discards the SQLSTATE. Map the ones this application
 * branches on back to the code Postgres actually raised.
 */
const PRISMA_CODE_TO_SQLSTATE: Record<string, string> = {
  P2002: PG_ERROR.UNIQUE_VIOLATION,
  P2003: PG_ERROR.FOREIGN_KEY_VIOLATION,
};

/**
 * Exclusion and check violations are not among the errors Prisma models, so
 * they surface as `PrismaClientUnknownRequestError` with the SQLSTATE present
 * only inside the driver text, e.g. `PostgresError { code: "23P01", … }`.
 */
const SQLSTATE_IN_MESSAGE = /PostgresError\s*\{\s*code:\s*"([0-9A-Za-z]{5})"/;

/**
 * Extracts the raw SQLSTATE from whichever shape Prisma wrapped it in.
 *
 * Callers branch on the SQLSTATE rather than on Prisma's own codes so that the
 * behaviour is tied to what PostgreSQL guarantees, not to how a given Prisma
 * release chose to classify it.
 */
export function getPostgresCode(error: unknown): string | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { code?: unknown } | undefined;
    if (typeof meta?.code === 'string') return meta.code;
    const mapped = PRISMA_CODE_TO_SQLSTATE[error.code];
    if (mapped) return mapped;
  }

  if (error instanceof Error) {
    const match = SQLSTATE_IN_MESSAGE.exec(error.message);
    if (match?.[1]) return match[1];
  }

  // A driver error that reached us unwrapped. SQLSTATE is five characters
  // beginning with two digits, which excludes Prisma's own `P####` codes.
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9]{2}[0-9A-Z]{3}$/.test(code)) return code;
  }

  return undefined;
}

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

  client.$on('warn', (event) => logger.warn({ prisma: event }, 'Prisma warning'));
  client.$on('error', (event) => logger.error({ prisma: event }, 'Prisma error'));

  if (env.isDevelopment) {
    client.$on('query', (event) => {
      // Params are omitted deliberately: they routinely carry password hashes,
      // tokens and payment payloads.
      logger.debug({ query: event.query, durationMs: event.duration }, 'Prisma query');
    });
  }

  return client;
}

/**
 * A single client per process.
 *
 * `tsx watch` re-imports modules on every change; without this the dev server
 * would leak a connection pool per reload until Postgres refused new
 * connections.
 */
const globalForPrisma = globalThis as unknown as { __bmdPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__bmdPrisma ?? createClient();

if (!env.isProduction) {
  globalForPrisma.__bmdPrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
