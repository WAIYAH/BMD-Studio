import type { Request, Response } from 'express';
import type {
  AccountBookingScope,
  AccountRentalScope,
  NotificationFilter,
  NotificationPreferencesData,
  PasswordChangeData,
  ProfileUpdateData,
} from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { requestContext } from '../lib/request-context.js';
import { sendData, sendPaginated } from '../lib/respond.js';
import * as account from '../services/account.service.js';
import type { AuthenticatedUser } from '../types/express.js';

function principal(req: Request): AuthenticatedUser {
  if (!req.user) throw ApiError.unauthenticated();
  return req.user;
}

type PageQuery = account.PageRequest;

function sendPage<T>(res: Response, query: PageQuery, result: account.PageResult<T>): void {
  sendPaginated(res, result.items, {
    page: query.page,
    pageSize: query.pageSize,
    total: result.total,
  });
}

export async function dashboard(req: Request, res: Response): Promise<void> {
  sendData(res, await account.getCustomerDashboard(principal(req).id));
}

export async function bookings(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PageQuery & { scope: AccountBookingScope };
  sendPage(res, query, await account.listBookings(principal(req).id, query.scope, query));
}

export async function rentals(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PageQuery & { scope: AccountRentalScope };
  sendPage(res, query, await account.listRentals(principal(req).id, query.scope, query));
}

export async function payments(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PageQuery;
  sendPage(res, query, await account.listPayments(principal(req).id, query));
}

export async function deliverables(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PageQuery;
  sendPage(res, query, await account.listDeliverables(principal(req).id, query));
}

export async function notifications(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as PageQuery & { filter: NotificationFilter };
  sendPage(res, query, await account.listNotifications(principal(req).id, query.filter, query));
}

export async function unreadNotificationCount(req: Request, res: Response): Promise<void> {
  sendData(res, { count: await account.countUnreadNotifications(principal(req).id) });
}

export async function readNotification(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await account.markNotificationRead(principal(req).id, id);
  sendData(res, { read: true });
}

export async function readAllNotifications(req: Request, res: Response): Promise<void> {
  sendData(res, { updated: await account.markAllNotificationsRead(principal(req).id) });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = await account.updateProfile(
    principal(req).id,
    req.body as ProfileUpdateData,
    requestContext(req),
  );
  sendData(res, user);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const user = principal(req);
  await account.changePassword(
    user.id,
    user.sessionId,
    req.body as PasswordChangeData,
    requestContext(req),
  );
  sendData(res, { changed: true });
}

export async function sessions(req: Request, res: Response): Promise<void> {
  const user = principal(req);
  sendData(res, await account.listSessions(user.id, user.sessionId));
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const user = principal(req);
  const { id } = req.params as { id: string };
  await account.revokeSession(user.id, id, user.sessionId, requestContext(req));
  sendData(res, { revoked: true });
}

export async function notificationPreferences(req: Request, res: Response): Promise<void> {
  sendData(res, await account.getNotificationPreferences(principal(req).id));
}

export async function updateNotificationPreferences(req: Request, res: Response): Promise<void> {
  const preferences = await account.updateNotificationPreferences(
    principal(req).id,
    req.body as NotificationPreferencesData,
    requestContext(req),
  );
  sendData(res, preferences);
}
