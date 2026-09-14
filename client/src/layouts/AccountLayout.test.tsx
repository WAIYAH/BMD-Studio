import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '@/features/account/api';
import * as broadcastApi from '@/features/broadcast/api';
import { LocationDisplay, authValue, renderWithProviders } from '@/test/render';
import { AccountLayout } from './AccountLayout';

function renderLayout(auth = authValue()) {
  renderWithProviders(
    <Routes>
      <Route path="/account" element={<AccountLayout />}>
        <Route index element={<p>Overview content</p>} />
      </Route>
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth, route: '/account' },
  );
  return auth;
}

describe('AccountLayout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(accountApi, 'fetchUnreadCount').mockResolvedValue(3);
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue({
      timezone: 'Africa/Nairobi',
      current: null,
      next: null,
    });
  });

  it('lays out the account sections with the current one marked', async () => {
    renderLayout();

    expect(screen.getByText('Overview content')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Account' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Payments' })).toHaveAttribute(
      'href',
      '/account/payments',
    );
    expect(within(nav).getByRole('link', { name: 'Profile & security' })).toHaveAttribute(
      'href',
      '/account/settings',
    );
    expect(
      await within(nav).findByRole('link', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument();
  });

  it('shows the unread count on the notifications bell', async () => {
    renderLayout();

    const header = screen.getByRole('banner');
    expect(
      await within(header).findByRole('link', { name: 'Notifications, 3 unread' }),
    ).toHaveAttribute('href', '/account/notifications');
  });

  it('signs out from the account menu and returns to the website', async () => {
    const auth = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/\|/);
  });

  it('opens the sections as a drawer on small screens and closes it with Escape', async () => {
    renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Account menu' });
    expect(within(drawer).getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Close menu' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Account menu' })).not.toBeInTheDocument();
  });
});
