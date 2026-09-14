import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardNotification } from '@bmd/shared';
import * as accountApi from '@/features/account/api';
import { renderWithProviders } from '@/test/render';
import { AccountNotificationsPage } from './AccountNotificationsPage';

const page = (items: DashboardNotification[]) => ({
  items,
  meta: { page: 1, pageSize: 10, total: items.length, totalPages: 1 },
});

const UNREAD: DashboardNotification = {
  id: 'n1',
  type: 'booking',
  title: 'Booking confirmed',
  body: 'See you on Thursday.',
  readAt: null,
  createdAt: '2026-09-12T10:00:00.000Z',
};

const READ: DashboardNotification = {
  id: 'n2',
  type: 'payment',
  title: 'Payment received',
  body: 'Thank you.',
  readAt: '2026-09-12T11:00:00.000Z',
  createdAt: '2026-09-12T10:30:00.000Z',
};

describe('AccountNotificationsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks a single notification read and refreshes the list', async () => {
    const fetch = vi
      .spyOn(accountApi, 'fetchNotifications')
      .mockResolvedValue(page([UNREAD, READ]));
    const markRead = vi.spyOn(accountApi, 'markNotificationRead').mockResolvedValue({ read: true });
    renderWithProviders(<AccountNotificationsPage />);

    const unread = await screen.findByRole('article', { name: 'Booking confirmed' });
    expect(
      within(screen.getByRole('article', { name: 'Payment received' })).queryByRole('button'),
    ).not.toBeInTheDocument();

    await userEvent.click(within(unread).getByRole('button', { name: 'Mark as read' }));

    await waitFor(() => expect(markRead).toHaveBeenCalled());
    expect(markRead.mock.calls[0]?.[0]).toBe('n1');
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(1));
  });

  it('marks everything read at once', async () => {
    vi.spyOn(accountApi, 'fetchNotifications').mockResolvedValue(page([UNREAD]));
    const markAll = vi
      .spyOn(accountApi, 'markAllNotificationsRead')
      .mockResolvedValue({ updated: 1 });
    renderWithProviders(<AccountNotificationsPage />);

    await screen.findByRole('article', { name: 'Booking confirmed' });
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => expect(markAll).toHaveBeenCalledTimes(1));
  });

  it('filters to unread notifications', async () => {
    const fetch = vi.spyOn(accountApi, 'fetchNotifications').mockResolvedValue(page([]));
    renderWithProviders(<AccountNotificationsPage />);

    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unread' }));

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('unread', 1));
    expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true');
  });
});
