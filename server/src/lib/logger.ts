import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Structured application logger.
 *
 * Redaction is not optional: authorization headers, cookies, passwords and
 * payment payloads must never reach a log sink.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'bmd-studio-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.currentPassword',
      '*.newPassword',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.consumerSecret',
      '*.passkey',
      '*.Password',
      'body.password',
      'body.token',
    ],
    censor: '[redacted]',
  },
  transport:
    env.isDevelopment && process.env.NO_PRETTY_LOGS !== 'true'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});

export type Logger = typeof logger;
