import type {
  AccountBookingScope,
  AccountRentalScope,
  AccountSession,
  AuthUser,
  CustomerDashboard,
  DashboardBooking,
  DashboardDeliverable,
  DashboardNotification,
  DashboardPayment,
  DashboardRental,
  NotificationFilter,
  NotificationPreference,
  PasswordChangeData,
  ProfileUpdateData,
} from '@bmd/shared';
import { api, type PaginatedResult } from '@/lib/api-client';

/** Rows per page on the account list screens. */
export const ACCOUNT_PAGE_SIZE = 10;

/** Every account query key starts with `me`, so signing out can clear them all at once. */
export const UNREAD_COUNT_QUERY_KEY = ['me', 'notifications', 'unread-count'] as const;

export function fetchDashboard(): Promise<CustomerDashboard> {
  return api.get<CustomerDashboard>('/me/dashboard');
}

export function fetchBookings(
  scope: AccountBookingScope,
  page: number,
): Promise<PaginatedResult<DashboardBooking>> {
  return api.paginated<DashboardBooking>({
    method: 'GET',
    url: '/me/bookings',
    params: { scope, page, pageSize: ACCOUNT_PAGE_SIZE },
  });
}

export function fetchRentals(
  scope: AccountRentalScope,
  page: number,
): Promise<PaginatedResult<DashboardRental>> {
  return api.paginated<DashboardRental>({
    method: 'GET',
    url: '/me/rentals',
    params: { scope, page, pageSize: ACCOUNT_PAGE_SIZE },
  });
}

export function fetchPayments(page: number): Promise<PaginatedResult<DashboardPayment>> {
  return api.paginated<DashboardPayment>({
    method: 'GET',
    url: '/me/payments',
    params: { page, pageSize: ACCOUNT_PAGE_SIZE },
  });
}

export function fetchDeliverables(page: number): Promise<PaginatedResult<DashboardDeliverable>> {
  return api.paginated<DashboardDeliverable>({
    method: 'GET',
    url: '/me/deliverables',
    params: { page, pageSize: ACCOUNT_PAGE_SIZE },
  });
}

export function fetchNotifications(
  filter: NotificationFilter,
  page: number,
): Promise<PaginatedResult<DashboardNotification>> {
  return api.paginated<DashboardNotification>({
    method: 'GET',
    url: '/me/notifications',
    params: { filter, page, pageSize: ACCOUNT_PAGE_SIZE },
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const result = await api.get<{ count: number }>('/me/notifications/unread-count');
  return result.count;
}

export function markNotificationRead(id: string): Promise<{ read: true }> {
  return api.post<{ read: true }>(`/me/notifications/${encodeURIComponent(id)}/read`);
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return api.post<{ updated: number }>('/me/notifications/read-all');
}

export function updateProfile(data: ProfileUpdateData): Promise<AuthUser> {
  return api.patch<AuthUser>('/me/profile', data);
}

export function changePassword(data: PasswordChangeData): Promise<{ changed: true }> {
  return api.post<{ changed: true }>('/me/password', data);
}

export function fetchSessions(): Promise<AccountSession[]> {
  return api.get<AccountSession[]>('/me/sessions');
}

export function revokeSession(id: string): Promise<{ revoked: true }> {
  return api.delete<{ revoked: true }>(`/me/sessions/${encodeURIComponent(id)}`);
}

export function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  return api.get<NotificationPreference[]>('/me/notification-preferences');
}

export function updateNotificationPreferences(
  preferences: NotificationPreference[],
): Promise<NotificationPreference[]> {
  return api.put<NotificationPreference[]>('/me/notification-preferences', { preferences });
}
