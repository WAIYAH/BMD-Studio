/**
 * Kenyan mobile number handling.
 *
 * Customers type numbers in every shape imaginable (0722…, 722…, +254722…,
 * 254 722 …). M-Pesa's Daraja API requires `2547XXXXXXXX` with no plus, while we
 * store E.164 (`+2547XXXXXXXX`). Normalising once, here, keeps both correct.
 */

const KE_COUNTRY_CODE = '254';

/** Valid Kenyan mobile subscriber numbers start 7XXXXXXXX or 1XXXXXXXX. */
const KE_MOBILE_SUBSCRIBER = /^[71]\d{8}$/;

/**
 * Returns the number in E.164 (`+2547XXXXXXXX`), or null when it is not a valid
 * Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  if (!input) return null;

  // Strip spaces, dashes, parentheses and dots.
  let digits = input.replace(/[\s\-().]/g, '');

  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  // 254722000000 -> 722000000
  if (digits.startsWith(KE_COUNTRY_CODE)) {
    digits = digits.slice(KE_COUNTRY_CODE.length);
  } else if (digits.startsWith('0')) {
    // 0722000000 -> 722000000
    digits = digits.slice(1);
  }

  if (!KE_MOBILE_SUBSCRIBER.test(digits)) return null;

  return `+${KE_COUNTRY_CODE}${digits}`;
}

export function isValidKenyanPhone(input: string): boolean {
  return normalizeKenyanPhone(input) !== null;
}

/** Daraja (M-Pesa) expects `2547XXXXXXXX` with no leading plus. */
export function toMpesaMsisdn(input: string): string | null {
  const normalized = normalizeKenyanPhone(input);
  return normalized ? normalized.slice(1) : null;
}

/** Display form: `0722 000 000`. */
export function formatKenyanPhone(input: string): string {
  const normalized = normalizeKenyanPhone(input);
  if (!normalized) return input;
  const subscriber = normalized.slice(4); // drop +254, leaving 9 digits
  return `0${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`;
}
