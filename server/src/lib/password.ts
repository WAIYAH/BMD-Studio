import argon2 from 'argon2';

/** Argon2id parameters. The seed hashes the bootstrap admin with the same settings. */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP minimum for argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies a password against a stored hash.
 *
 * When there is no account (`hash` is null) a verify still runs against a
 * throwaway hash, so response time does not reveal whether an email is
 * registered. A malformed stored hash counts as a mismatch, never a crash.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= argon2.hash('timing-equaliser-not-a-credential', ARGON_OPTIONS);
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
