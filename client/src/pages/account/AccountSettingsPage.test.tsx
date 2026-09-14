import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type AccountSession,
  type NotificationPreference,
} from '@bmd/shared';
import * as accountApi from '@/features/account/api';
import { TEST_USER, authValue, renderWithProviders } from '@/test/render';
import { AccountSettingsPage } from './AccountSettingsPage';

const SESSIONS: AccountSession[] = [
  {
    id: 'family-1',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    ipAddress: '197.232.1.10',
    signedInAt: '2026-09-10T08:00:00.000Z',
    lastActiveAt: '2026-09-14T08:00:00.000Z',
    expiresAt: '2026-10-10T08:00:00.000Z',
    current: true,
  },
  {
    id: 'family-2',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ipAddress: '105.160.2.20',
    signedInAt: '2026-09-11T08:00:00.000Z',
    lastActiveAt: '2026-09-13T08:00:00.000Z',
    expiresAt: '2026-10-11T08:00:00.000Z',
    current: false,
  },
];

const PREFERENCES: NotificationPreference[] = NOTIFICATION_CHANNELS.flatMap((channel) =>
  NOTIFICATION_CATEGORIES.map((category) => ({
    channel,
    category,
    enabled: category !== 'marketing',
  })),
);

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(accountApi, 'fetchSessions').mockResolvedValue(SESSIONS);
    vi.spyOn(accountApi, 'fetchNotificationPreferences').mockResolvedValue(PREFERENCES);
  });

  it('checks the mobile number before saving the profile', async () => {
    const update = vi.spyOn(accountApi, 'updateProfile');
    renderWithProviders(<AccountSettingsPage />);

    const phone = screen.getByLabelText('Mobile number');
    await userEvent.clear(phone);
    await userEvent.type(phone, '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(
      await screen.findByText('Enter a valid Kenyan mobile number, e.g. 0722 000 000.'),
    ).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('saves the profile and updates the signed-in user', async () => {
    const auth = authValue();
    const updated = { ...TEST_USER, firstName: 'Wanjiru' };
    vi.spyOn(accountApi, 'updateProfile').mockResolvedValue(updated);
    renderWithProviders(<AccountSettingsPage />, { auth });

    const firstName = screen.getByLabelText('First name');
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Wanjiru');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(auth.setUser).toHaveBeenCalledWith(updated);
  });

  it('refuses new passwords that do not match', async () => {
    const change = vi.spyOn(accountApi, 'changePassword');
    renderWithProviders(<AccountSettingsPage />);

    await userEvent.type(screen.getByLabelText('Current password'), 'studio-pass-123');
    await userEvent.type(screen.getByLabelText('New password'), 'new-pass-4567');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-pass-9999');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('The new passwords do not match.')).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('lists signed-in devices and signs out another one', async () => {
    const revoke = vi.spyOn(accountApi, 'revokeSession').mockResolvedValue({ revoked: true });
    renderWithProviders(<AccountSettingsPage />);

    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sign out Chrome on Windows' }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out Safari on iOS' }));

    await waitFor(() => expect(revoke).toHaveBeenCalled());
    expect(revoke.mock.calls[0]?.[0]).toBe('family-2');
  });

  it('keeps marketing off until the customer opts in, and saves the choice', async () => {
    const save = vi
      .spyOn(accountApi, 'updateNotificationPreferences')
      .mockImplementation((preferences) => Promise.resolve(preferences));
    renderWithProviders(<AccountSettingsPage />);

    const marketingEmail = await screen.findByRole('checkbox', { name: 'News & offers by Email' });
    expect(marketingEmail).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();

    await userEvent.click(marketingEmail);
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    const sent = save.mock.calls[0]?.[0] ?? [];
    expect(sent.find((p) => p.channel === 'EMAIL' && p.category === 'marketing')?.enabled).toBe(
      true,
    );
    expect(await screen.findByText('Preferences saved.')).toBeInTheDocument();
  });
});
