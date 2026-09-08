/**
 * Roles and permissions.
 *
 * These constants are the canonical vocabulary; the authoritative grants live in
 * the database (`roles`, `permissions`, `role_permissions`) and are seeded from
 * ROLE_PERMISSIONS below, so an operator can adjust grants without a deploy.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  STUDIO_ADMIN: 'STUDIO_ADMIN',
  STUDIO_MANAGER: 'STUDIO_MANAGER',
  PRODUCER: 'PRODUCER',
  PRESENTER: 'PRESENTER',
  TECHNICIAN: 'TECHNICIAN',
  MEDIA_STAFF: 'MEDIA_STAFF',
  FINANCE: 'FINANCE',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Human-readable role labels for admin UI. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  STUDIO_ADMIN: 'Studio Admin',
  STUDIO_MANAGER: 'Studio Manager',
  PRODUCER: 'Producer',
  PRESENTER: 'Presenter / Host',
  TECHNICIAN: 'Technician',
  MEDIA_STAFF: 'Photographer / Media Staff',
  FINANCE: 'Finance & Admin Staff',
  CUSTOMER: 'Customer',
};

/**
 * Permission strings follow `<resource>:<action>[:scope]`, where scope is
 * `own` (only rows the actor owns) or `any` (every row).
 */
export const PERMISSIONS = {
  // users & access control
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_STATUS_WRITE: 'user:status:write',
  USER_ROLE_ASSIGN: 'user:role:assign',
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',

  // studio configuration
  STUDIO_READ: 'studio:read',
  STUDIO_WRITE: 'studio:write',
  SERVICE_READ: 'service:read',
  SERVICE_WRITE: 'service:write',

  // bookings
  BOOKING_READ_OWN: 'booking:read:own',
  BOOKING_READ_ANY: 'booking:read:any',
  BOOKING_CREATE: 'booking:create',
  BOOKING_UPDATE_OWN: 'booking:update:own',
  BOOKING_UPDATE_ANY: 'booking:update:any',
  BOOKING_CANCEL_OWN: 'booking:cancel:own',
  BOOKING_CANCEL_ANY: 'booking:cancel:any',
  BOOKING_APPROVE: 'booking:approve',

  // equipment
  EQUIPMENT_READ: 'equipment:read',
  EQUIPMENT_WRITE: 'equipment:write',
  EQUIPMENT_MAINTENANCE_WRITE: 'equipment:maintenance:write',
  RENTAL_READ_OWN: 'rental:read:own',
  RENTAL_READ_ANY: 'rental:read:any',
  RENTAL_CREATE: 'rental:create',
  RENTAL_APPROVE: 'rental:approve',
  RENTAL_CHECKOUT: 'rental:checkout',
  RENTAL_RETURN: 'rental:return',

  // shows & broadcast
  SHOW_READ: 'show:read',
  SHOW_WRITE: 'show:write',
  SHOW_HOST_ASSIGN: 'show:host:assign',
  ONAIR_CONTROL: 'onair:control',
  STREAM_READ: 'stream:read',
  STREAM_WRITE: 'stream:write',
  STREAM_CONTROL: 'stream:control',

  // media
  MEDIA_READ: 'media:read',
  MEDIA_UPLOAD: 'media:upload',
  MEDIA_DELETE: 'media:delete',
  GALLERY_WRITE: 'gallery:write',

  // payments
  PAYMENT_READ_OWN: 'payment:read:own',
  PAYMENT_READ_ANY: 'payment:read:any',
  PAYMENT_REFUND: 'payment:refund',

  // notifications
  NOTIFICATION_BROADCAST: 'notification:broadcast',

  // administration
  DASHBOARD_VIEW: 'dashboard:view',
  REPORT_VIEW: 'report:view',
  AUDIT_READ: 'audit:read',
  SETTINGS_WRITE: 'settings:write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

const CUSTOMER_PERMISSIONS: Permission[] = [
  P.STUDIO_READ,
  P.SERVICE_READ,
  P.EQUIPMENT_READ,
  P.SHOW_READ,
  P.STREAM_READ,
  P.MEDIA_READ,
  P.BOOKING_READ_OWN,
  P.BOOKING_CREATE,
  P.BOOKING_UPDATE_OWN,
  P.BOOKING_CANCEL_OWN,
  P.RENTAL_READ_OWN,
  P.RENTAL_CREATE,
  P.PAYMENT_READ_OWN,
];

const STAFF_BASELINE: Permission[] = [
  P.STUDIO_READ,
  P.SERVICE_READ,
  P.EQUIPMENT_READ,
  P.SHOW_READ,
  P.STREAM_READ,
  P.MEDIA_READ,
  P.DASHBOARD_VIEW,
];

/**
 * Baseline grants seeded into the database. Deliberately least-privilege: a role
 * only appears against a permission when the operational job actually needs it.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Full control. Seeded with every permission at runtime (see server seed).
  SUPER_ADMIN: Object.values(P),

  STUDIO_ADMIN: Object.values(P).filter(
    (perm) => perm !== P.ROLE_WRITE && perm !== P.USER_ROLE_ASSIGN,
  ),

  STUDIO_MANAGER: [
    ...STAFF_BASELINE,
    P.USER_READ,
    P.STUDIO_WRITE,
    P.SERVICE_WRITE,
    P.BOOKING_READ_ANY,
    P.BOOKING_CREATE,
    P.BOOKING_UPDATE_ANY,
    P.BOOKING_CANCEL_ANY,
    P.BOOKING_APPROVE,
    P.EQUIPMENT_WRITE,
    P.RENTAL_READ_ANY,
    P.RENTAL_APPROVE,
    P.RENTAL_CHECKOUT,
    P.RENTAL_RETURN,
    P.SHOW_WRITE,
    P.SHOW_HOST_ASSIGN,
    P.ONAIR_CONTROL,
    P.STREAM_WRITE,
    P.STREAM_CONTROL,
    P.MEDIA_UPLOAD,
    P.GALLERY_WRITE,
    P.PAYMENT_READ_ANY,
    P.NOTIFICATION_BROADCAST,
    P.REPORT_VIEW,
  ],

  PRODUCER: [
    ...STAFF_BASELINE,
    P.BOOKING_READ_ANY,
    P.SHOW_WRITE,
    P.SHOW_HOST_ASSIGN,
    P.ONAIR_CONTROL,
    P.STREAM_WRITE,
    P.STREAM_CONTROL,
    P.MEDIA_UPLOAD,
    P.GALLERY_WRITE,
  ],

  // A presenter sees the schedule and their own shows; they change nothing.
  PRESENTER: [...STAFF_BASELINE],

  TECHNICIAN: [
    ...STAFF_BASELINE,
    P.BOOKING_READ_ANY,
    P.EQUIPMENT_WRITE,
    P.EQUIPMENT_MAINTENANCE_WRITE,
    P.RENTAL_READ_ANY,
    P.RENTAL_APPROVE,
    P.RENTAL_CHECKOUT,
    P.RENTAL_RETURN,
    P.ONAIR_CONTROL,
    P.STREAM_CONTROL,
  ],

  MEDIA_STAFF: [
    ...STAFF_BASELINE,
    P.BOOKING_READ_ANY,
    P.MEDIA_UPLOAD,
    P.MEDIA_DELETE,
    P.GALLERY_WRITE,
  ],

  FINANCE: [
    ...STAFF_BASELINE,
    P.BOOKING_READ_ANY,
    P.RENTAL_READ_ANY,
    P.PAYMENT_READ_ANY,
    P.PAYMENT_REFUND,
    P.REPORT_VIEW,
  ],

  CUSTOMER: CUSTOMER_PERMISSIONS,
};

/** True when the permission set covers `required` (exact match, no wildcards). */
export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(granted: readonly string[], required: Permission[]): boolean {
  return required.some((perm) => granted.includes(perm));
}

/** Roles that may reach the staff-facing management area at all. */
export const STAFF_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.STUDIO_ADMIN,
  ROLES.STUDIO_MANAGER,
  ROLES.PRODUCER,
  ROLES.PRESENTER,
  ROLES.TECHNICIAN,
  ROLES.MEDIA_STAFF,
  ROLES.FINANCE,
];

export function isStaffRole(role: string): boolean {
  return (STAFF_ROLES as string[]).includes(role);
}
