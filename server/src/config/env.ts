import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '../..');

// `.env` is optional in deployed environments, where the platform injects
// configuration directly into the process environment.
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const csv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TIMEZONE: z.string().default('Africa/Nairobi'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  CLIENT_PUBLIC_URL: z.string().url().default('http://localhost:5173'),

  // Required from Phase 2 onwards; optional while the schema is being built so
  // the server can boot and serve /health before a database exists.
  DATABASE_URL: z.string().optional(),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(50),

  // Payments. `mock` never runs in production — enforced below.
  PAYMENTS_DRIVER: z.enum(['daraja', 'mock']).default('mock'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Configuration errors must be loud and fatal, not silently defaulted.
  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

const raw = parsed.data;

if (raw.NODE_ENV === 'production' && raw.PAYMENTS_DRIVER === 'mock') {
  throw new Error(
    'PAYMENTS_DRIVER=mock is not permitted when NODE_ENV=production. ' +
      'Configure the real M-Pesa Daraja credentials.',
  );
}

export const env = {
  ...raw,
  corsOrigins: csv(raw.CORS_ORIGINS),
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  isDevelopment: raw.NODE_ENV === 'development',
  cookieSecure: process.env.COOKIE_SECURE
    ? booleanish.parse(process.env.COOKIE_SECURE)
    : raw.NODE_ENV === 'production',
} as const;

export type Env = typeof env;
