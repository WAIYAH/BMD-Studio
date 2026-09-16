import { randomInt } from 'node:crypto';
import { isUniqueViolation } from './prisma.js';

/**
 * Crockford's base32: no I, L, O or U, so a reference read down a phone line
 * cannot be confused with 1, 0 or a swear word.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const REFERENCE_LENGTH = 6;

/** A customer-facing reference such as `BMD-7QF2K9`. */
function generateReference(prefix: string, length = REFERENCE_LENGTH): string {
  let suffix = '';
  for (let index = 0; index < length; index += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

const MAX_ATTEMPTS = 5;

/**
 * Runs `attempt` with a fresh reference, retrying if the database already holds
 * one. With 32^6 possibilities a collision is vanishingly rare, but "rare" is
 * not "impossible", and the alternative is a failed booking.
 */
export async function withReference<T>(
  prefix: string,
  attempt: (reference: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    try {
      return await attempt(generateReference(prefix));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}
