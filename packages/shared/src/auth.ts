import { z } from 'zod';
import type { UserStatusValue } from './domain.js';
import { normalizeKenyanPhone } from './phone.js';

/**
 * Credential schemas. The server validates requests with these and the client
 * validates forms with the same objects, so the two can never disagree.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(254, 'Email address is too long.'));

const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(80, `${label} must be at most 80 characters.`);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`)
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    'Password must contain at least one letter and one number.',
  );

const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid Kenyan mobile number, e.g. 0722 000 000.',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const registerSchema = z.object({
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  email: emailSchema,
  phone: optionalPhoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // No policy check on login: an old account may predate the current policy.
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX_LENGTH),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;

/** The signed-in principal as the client sees it. */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatusValue;
  emailVerified: boolean;
  /** Role keys from the database; normally members of `ROLES`. */
  roles: string[];
  /** Effective permission keys, the union over every role. */
  permissions: string[];
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  /** Access-token lifetime in seconds from issue. */
  expiresIn: number;
  user: AuthUser;
}
