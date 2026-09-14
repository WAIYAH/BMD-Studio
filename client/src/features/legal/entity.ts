/**
 * Who the legal pages speak for. Kept in one place so that a registered company
 * name or postal address, once available, is added here and nowhere else.
 */
export const LEGAL_ENTITY = {
  name: 'B.M.D Studio',
  location: 'Nairobi, Kenya',
} as const;

/**
 * The date the current wording of the legal pages took effect. Change it
 * whenever their substance changes.
 */
export const LEGAL_LAST_UPDATED = '2026-09-14';

export const LEGAL_PAGES = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Use' },
  { to: '/cookies', label: 'Cookie Policy' },
  { to: '/booking-terms', label: 'Booking & Hire Terms' },
] as const;
