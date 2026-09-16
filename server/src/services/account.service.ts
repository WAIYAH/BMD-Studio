import type { BookingStatus, Prisma, RentalStatus } from '@prisma/client';
import {
  API_ERROR_CODES,
  HOLDING_BOOKING_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  OPEN_RENTAL_STATUSES,
  defaultNotificationPreference,
  type AccountBookingScope,
  type AccountRentalScope,
  type AccountSession,
  type AuthUser,
  type CustomerDashboard,
  type DashboardBooking,
  type DashboardDeliverable,
  type DashboardNotification,
  type DashboardPayment,
  type DashboardRental,
  type NotificationFilter,
  type NotificationPreference,
  type NotificationPreferencesData,
  type PasswordChangeData,
  type ProfileUpdateData,
} from '@bmd/shared';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { auditRow, type RequestContext } from '../lib/audit.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { isUniqueViolation, prisma } from '../lib/prisma.js';
import { REVOKE_REASON, revokeFamily, toAuthUser, userWithGrants } from './auth.service.js';

/**
 * The signed-in customer's own records. Every query here filters by the
 * caller's id in SQL; no function accepts another user's id from a request.
 */

const HOLDING: BookingStatus[] = [...HOLDING_BOOKING_STATUSES];
const OPEN_RENTALS: RentalStatus[] = [...OPEN_RENTAL_STATUSES];

/** Bookings and rentals a customer owes money on (docs/DASHBOARD_PLAN.md §4). */
const BILLABLE_BOOKINGS: BookingStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_APPROVAL',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
];
const BILLABLE_RENTALS: RentalStatus[] = ['APPROVED', 'CHECKED_OUT', 'OVERDUE', 'RETURNED'];

const DASHBOARD_LIST_SIZE = 5;

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

const pageWindow = ({ page, pageSize }: PageRequest) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// ---------------------------------------------------------------------------
// Row shapes and mapping
// ---------------------------------------------------------------------------

const BOOKING_SELECT = {
  id: true,
  reference: true,
  status: true,
  startsAt: true,
  endsAt: true,
  totalCents: true,
  studio: { select: { name: true } },
  room: { select: { name: true } },
  service: { select: { name: true } },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

const RENTAL_SELECT = {
  id: true,
  reference: true,
  status: true,
  startsAt: true,
  endsAt: true,
  totalCents: true,
  items: { orderBy: { createdAt: 'asc' }, select: { equipment: { select: { name: true } } } },
} satisfies Prisma.EquipmentRentalSelect;

type RentalRow = Prisma.EquipmentRentalGetPayload<{ select: typeof RENTAL_SELECT }>;

export const PAYMENT_SELECT = {
  id: true,
  reference: true,
  status: true,
  provider: true,
  purpose: true,
  amountCents: true,
  receiptNumber: true,
  createdAt: true,
  paidAt: true,
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>;

export const DELIVERABLE_SELECT = {
  id: true,
  title: true,
  dueAt: true,
  deliveredAt: true,
  booking: { select: { reference: true } },
  gallery: { select: { slug: true, isPublished: true } },
} satisfies Prisma.BookingDeliverableSelect;

type DeliverableRow = Prisma.BookingDeliverableGetPayload<{ select: typeof DELIVERABLE_SELECT }>;

function toBooking(row: BookingRow, paid: Map<string, number>): DashboardBooking {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    studioName: row.studio.name,
    roomName: row.room.name,
    serviceName: row.service.name,
    totalCents: row.totalCents,
    paidCents: paid.get(row.id) ?? 0,
  };
}

/** `['Shure SM7B', 'Shure SM7B', 'Tripod']` → `['Shure SM7B × 2', 'Tripod']`. */
function itemLabels(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} × ${count}` : name));
}

function toRental(row: RentalRow, paid: Map<string, number>, now: Date): DashboardRental {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    totalCents: row.totalCents,
    paidCents: paid.get(row.id) ?? 0,
    isOverdue: row.status === 'OVERDUE' || (row.status === 'CHECKED_OUT' && row.endsAt <= now),
    items: itemLabels(row.items.map((item) => item.equipment.name)),
  };
}

export function toPayment(row: PaymentRow): DashboardPayment {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    provider: row.provider,
    purpose: row.purpose,
    amountCents: row.amountCents,
    receiptNumber: row.receiptNumber,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

function toNotification(row: NotificationRow): DashboardNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDeliverable(row: DeliverableRow): DashboardDeliverable {
  return {
    id: row.id,
    title: row.title,
    bookingReference: row.booking.reference,
    dueAt: row.dueAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    gallerySlug: row.gallery?.isPublished ? row.gallery.slug : null,
  };
}

/** Successful payments only: a pending or failed payment has not reduced what is owed. */
async function paidByBooking(
  customerId: string,
  bookingIds: string[],
): Promise<Map<string, number>> {
  const paid = new Map<string, number>();
  if (bookingIds.length === 0) return paid;
  const rows = await prisma.payment.groupBy({
    by: ['bookingId'],
    where: { customerId, status: 'SUCCESSFUL', bookingId: { in: bookingIds } },
    _sum: { amountCents: true },
  });
  for (const row of rows) {
    if (row.bookingId) paid.set(row.bookingId, row._sum.amountCents ?? 0);
  }
  return paid;
}

async function paidByRental(customerId: string, rentalIds: string[]): Promise<Map<string, number>> {
  const paid = new Map<string, number>();
  if (rentalIds.length === 0) return paid;
  const rows = await prisma.payment.groupBy({
    by: ['rentalId'],
    where: { customerId, status: 'SUCCESSFUL', rentalId: { in: rentalIds } },
    _sum: { amountCents: true },
  });
  for (const row of rows) {
    if (row.rentalId) paid.set(row.rentalId, row._sum.amountCents ?? 0);
  }
  return paid;
}

function bookingScope(
  customerId: string,
  scope: AccountBookingScope,
  now: Date,
): Prisma.BookingWhereInput {
  return scope === 'upcoming'
    ? { customerId, status: { in: HOLDING }, endsAt: { gt: now } }
    : { customerId, OR: [{ endsAt: { lte: now } }, { status: { notIn: HOLDING } }] };
}

function rentalScope(
  customerId: string,
  scope: AccountRentalScope,
): Prisma.EquipmentRentalWhereInput {
  return scope === 'active'
    ? { customerId, status: { in: OPEN_RENTALS } }
    : { customerId, status: { notIn: OPEN_RENTALS } };
}

const owedOn = (items: Array<{ id: string; totalCents: number }>, paid: Map<string, number>) =>
  items.reduce((sum, item) => sum + Math.max(0, item.totalCents - (paid.get(item.id) ?? 0)), 0);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getCustomerDashboard(
  userId: string,
  now = new Date(),
): Promise<CustomerDashboard> {
  const upcomingWhere = bookingScope(userId, 'upcoming', now);
  const activeRentalWhere = rentalScope(userId, 'active');

  const [
    user,
    upcomingRows,
    upcomingCount,
    recentRows,
    rentalRows,
    rentalCount,
    paymentRows,
    notificationRows,
    unreadCount,
    deliverableRows,
    billableBookings,
    billableRentals,
    paidTotal,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: upcomingWhere,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_SIZE,
      select: BOOKING_SELECT,
    }),
    prisma.booking.count({ where: upcomingWhere }),
    prisma.booking.findMany({
      where: bookingScope(userId, 'past', now),
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_SIZE,
      select: BOOKING_SELECT,
    }),
    prisma.equipmentRental.findMany({
      where: activeRentalWhere,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_SIZE,
      select: RENTAL_SELECT,
    }),
    prisma.equipmentRental.count({ where: activeRentalWhere }),
    prisma.payment.findMany({
      where: { customerId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_SIZE,
      select: PAYMENT_SELECT,
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_SIZE,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.bookingDeliverable.findMany({
      where: { booking: { customerId: userId } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_SIZE,
      select: DELIVERABLE_SELECT,
    }),
    prisma.booking.findMany({
      where: { customerId: userId, status: { in: BILLABLE_BOOKINGS } },
      select: { id: true, totalCents: true },
    }),
    prisma.equipmentRental.findMany({
      where: { customerId: userId, status: { in: BILLABLE_RENTALS } },
      select: { id: true, totalCents: true },
    }),
    prisma.payment.aggregate({
      where: { customerId: userId, status: 'SUCCESSFUL' },
      _sum: { amountCents: true },
    }),
  ]);

  const bookingIds = [
    ...new Set([...billableBookings, ...upcomingRows, ...recentRows].map((row) => row.id)),
  ];
  const rentalIds = [...new Set([...billableRentals, ...rentalRows].map((row) => row.id))];
  const [bookingPaid, rentalPaid] = await Promise.all([
    paidByBooking(userId, bookingIds),
    paidByRental(userId, rentalIds),
  ]);

  return {
    generatedAt: now.toISOString(),
    timezone: env.TIMEZONE,
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerifiedAt !== null,
      memberSince: user.createdAt.toISOString(),
    },
    stats: {
      upcomingBookings: upcomingCount,
      activeRentals: rentalCount,
      balanceDueCents: owedOn(billableBookings, bookingPaid) + owedOn(billableRentals, rentalPaid),
      totalPaidCents: paidTotal._sum.amountCents ?? 0,
      unreadNotifications: unreadCount,
    },
    upcomingBookings: upcomingRows.map((row) => toBooking(row, bookingPaid)),
    recentBookings: recentRows.map((row) => toBooking(row, bookingPaid)),
    activeRentals: rentalRows.map((row) => toRental(row, rentalPaid, now)),
    recentPayments: paymentRows.map(toPayment),
    notifications: notificationRows.map(toNotification),
    deliverables: deliverableRows.map(toDeliverable),
  };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function listBookings(
  userId: string,
  scope: AccountBookingScope,
  page: PageRequest,
  now = new Date(),
): Promise<PageResult<DashboardBooking>> {
  const where = bookingScope(userId, scope, now);
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ startsAt: scope === 'upcoming' ? 'asc' : 'desc' }, { id: 'asc' }],
      ...pageWindow(page),
      select: BOOKING_SELECT,
    }),
    prisma.booking.count({ where }),
  ]);
  const paid = await paidByBooking(
    userId,
    rows.map((row) => row.id),
  );
  return { items: rows.map((row) => toBooking(row, paid)), total };
}

export async function listRentals(
  userId: string,
  scope: AccountRentalScope,
  page: PageRequest,
  now = new Date(),
): Promise<PageResult<DashboardRental>> {
  const where = rentalScope(userId, scope);
  const [rows, total] = await Promise.all([
    prisma.equipmentRental.findMany({
      where,
      orderBy: [{ startsAt: scope === 'active' ? 'asc' : 'desc' }, { id: 'asc' }],
      ...pageWindow(page),
      select: RENTAL_SELECT,
    }),
    prisma.equipmentRental.count({ where }),
  ]);
  const paid = await paidByRental(
    userId,
    rows.map((row) => row.id),
  );
  return { items: rows.map((row) => toRental(row, paid, now)), total };
}

export async function listPayments(
  userId: string,
  page: PageRequest,
): Promise<PageResult<DashboardPayment>> {
  const where = { customerId: userId };
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(page),
      select: PAYMENT_SELECT,
    }),
    prisma.payment.count({ where }),
  ]);
  return { items: rows.map(toPayment), total };
}

export async function listDeliverables(
  userId: string,
  page: PageRequest,
): Promise<PageResult<DashboardDeliverable>> {
  const where = { booking: { customerId: userId } };
  const [rows, total] = await Promise.all([
    prisma.bookingDeliverable.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(page),
      select: DELIVERABLE_SELECT,
    }),
    prisma.bookingDeliverable.count({ where }),
  ]);
  return { items: rows.map(toDeliverable), total };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listNotifications(
  userId: string,
  filter: NotificationFilter,
  page: PageRequest,
): Promise<PageResult<DashboardNotification>> {
  const where: Prisma.NotificationWhereInput =
    filter === 'unread' ? { userId, readAt: null } : { userId };
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageWindow(page),
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items: rows.map(toNotification), total };
}

export function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count > 0) return;

  // Nothing changed: either it was already read, or it is not the caller's.
  const owned = await prisma.notification.count({ where: { id: notificationId, userId } });
  if (owned === 0) throw ApiError.notFound('Notification');
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Profile and security
// ---------------------------------------------------------------------------

export async function updateProfile(
  userId: string,
  data: ProfileUpdateData,
  ctx: RequestContext,
): Promise<AuthUser> {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone ?? null },
        include: userWithGrants,
      });
      await tx.auditLog.create({
        data: auditRow(
          {
            action: 'account.profile_updated',
            entityType: 'user',
            entityId: userId,
            actorId: userId,
          },
          ctx,
        ),
      });
      return updated;
    });
    return toAuthUser(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ApiError.conflict(
        API_ERROR_CODES.CONFLICT,
        'That phone number is already registered to another account.',
      );
    }
    throw error;
  }
}

const passwordFieldError = (path: string, message: string) =>
  new ApiError(400, API_ERROR_CODES.VALIDATION_ERROR, message, { details: [{ path, message }] });

/**
 * Changes the password and signs out every other device, so anyone who knew
 * the old password loses access. The device making the change stays signed in.
 */
export async function changePassword(
  userId: string,
  sessionId: string,
  data: PasswordChangeData,
  ctx: RequestContext,
): Promise<void> {
  const [user, current] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } }),
    prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { familyId: true } }),
  ]);

  if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
    throw passwordFieldError('currentPassword', 'Your current password is incorrect.');
  }
  if (await verifyPassword(user.passwordHash, data.newPassword)) {
    throw passwordFieldError('newPassword', 'Choose a password different from your current one.');
  }

  const passwordHash = await hashPassword(data.newPassword);
  const otherDevices = { userId, NOT: { familyId: current.familyId } };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { ...otherDevices, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: REVOKE_REASON.PASSWORD_CHANGED },
    }),
    // Rotated rows still back the access tokens minted before rotation;
    // relabelling them ends those tokens too.
    prisma.session.updateMany({
      where: { ...otherDevices, revokedReason: REVOKE_REASON.ROTATED },
      data: { revokedReason: REVOKE_REASON.PASSWORD_CHANGED },
    }),
    prisma.auditLog.create({
      data: auditRow(
        {
          action: 'account.password_changed',
          entityType: 'user',
          entityId: userId,
          actorId: userId,
        },
        ctx,
      ),
    }),
  ]);
}

export async function listSessions(
  userId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<AccountSession[]> {
  const [live, current] = await Promise.all([
    prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        familyId: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.session.findUnique({ where: { id: currentSessionId }, select: { familyId: true } }),
  ]);
  if (live.length === 0) return [];

  // A family's first row is when that device signed in; its live row is the latest renewal.
  const firsts = await prisma.session.groupBy({
    by: ['familyId'],
    where: { userId, familyId: { in: live.map((session) => session.familyId) } },
    _min: { createdAt: true },
  });
  const signedInAt = new Map(firsts.map((row) => [row.familyId, row._min.createdAt]));

  return live
    .map((session) => ({
      id: session.familyId,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      signedInAt: (signedInAt.get(session.familyId) ?? session.createdAt).toISOString(),
      lastActiveAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.familyId === current?.familyId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function revokeSession(
  userId: string,
  familyId: string,
  currentSessionId: string,
  ctx: RequestContext,
): Promise<void> {
  const [owned, current] = await Promise.all([
    prisma.session.count({ where: { userId, familyId } }),
    prisma.session.findUnique({ where: { id: currentSessionId }, select: { familyId: true } }),
  ]);
  if (owned === 0) throw ApiError.notFound('Session');
  if (current?.familyId === familyId) {
    throw ApiError.badRequest('This is the device you are using now. Sign out instead.');
  }

  await revokeFamily(familyId, REVOKE_REASON.REVOKED_BY_USER);
  await prisma.auditLog.create({
    data: auditRow(
      {
        action: 'account.session_revoked',
        entityType: 'session',
        entityId: familyId,
        actorId: userId,
      },
      ctx,
    ),
  });
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

function preferenceMatrix(
  rows: Array<{ channel: string; category: string; enabled: boolean }>,
): NotificationPreference[] {
  const stored = new Map(rows.map((row) => [`${row.channel}:${row.category}`, row.enabled]));
  return NOTIFICATION_CHANNELS.flatMap((channel) =>
    NOTIFICATION_CATEGORIES.map((category) => ({
      channel,
      category,
      enabled: stored.get(`${channel}:${category}`) ?? defaultNotificationPreference(category),
    })),
  );
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreference[]> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, channel: { in: [...NOTIFICATION_CHANNELS] } },
    select: { channel: true, category: true, enabled: true },
  });
  return preferenceMatrix(rows);
}

export async function updateNotificationPreferences(
  userId: string,
  data: NotificationPreferencesData,
  ctx: RequestContext,
): Promise<NotificationPreference[]> {
  await prisma.$transaction([
    ...data.preferences.map((preference) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_channel_category: {
            userId,
            channel: preference.channel,
            category: preference.category,
          },
        },
        update: { enabled: preference.enabled },
        create: { userId, ...preference },
      }),
    ),
    prisma.auditLog.create({
      data: auditRow(
        {
          action: 'account.notification_preferences_updated',
          entityType: 'user',
          entityId: userId,
          actorId: userId,
          after: data.preferences,
        },
        ctx,
      ),
    }),
  ]);
  return getNotificationPreferences(userId);
}
