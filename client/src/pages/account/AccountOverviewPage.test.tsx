import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKes, type CustomerDashboard } from '@bmd/shared';
import * as accountApi from '@/features/account/api';
import { ApiClientError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { AccountOverviewPage } from './AccountOverviewPage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const EMPTY: CustomerDashboard = {
  generatedAt: '2026-09-14T09:00:00.000Z',
  timezone: 'Africa/Nairobi',
  profile: {
    firstName: 'Wanjiku',
    lastName: 'Kamau',
    email: 'wanjiku@example.test',
    phone: '+254722000000',
    emailVerified: false,
    memberSince: '2026-09-01T08:00:00.000Z',
  },
  stats: {
    upcomingBookings: 0,
    activeRentals: 0,
    balanceDueCents: 0,
    totalPaidCents: 0,
    unreadNotifications: 0,
  },
  upcomingBookings: [],
  recentBookings: [],
  activeRentals: [],
  recentPayments: [],
  notifications: [],
  deliverables: [],
};

const FULL: CustomerDashboard = {
  ...EMPTY,
  stats: {
    upcomingBookings: 2,
    activeRentals: 1,
    balanceDueCents: 300_000,
    totalPaidCents: 450_000,
    unreadNotifications: 1,
  },
  upcomingBookings: [
    {
      id: 'b1',
      reference: 'BMD-000001',
      status: 'CONFIRMED',
      startsAt: '2026-09-17T07:00:00.000Z',
      endsAt: '2026-09-17T09:00:00.000Z',
      studioName: 'B.M.D Studio',
      roomName: 'Podcast Studio A',
      serviceName: 'Podcast Recording',
      totalCents: 500_000,
      paidCents: 200_000,
    },
  ],
  activeRentals: [
    {
      id: 'r1',
      reference: 'HIRE-000001',
      status: 'CHECKED_OUT',
      startsAt: '2026-09-11T07:00:00.000Z',
      endsAt: '2026-09-13T07:00:00.000Z',
      totalCents: 600_000,
      paidCents: 600_000,
      isOverdue: true,
      items: ['Shure SM7B × 2'],
    },
  ],
  recentPayments: [
    {
      id: 'p1',
      reference: 'PAY-000001',
      status: 'SUCCESSFUL',
      provider: 'MPESA',
      purpose: 'BOOKING',
      amountCents: 200_000,
      receiptNumber: 'SJK4H2L9QX',
      createdAt: '2026-09-12T10:00:00.000Z',
      paidAt: '2026-09-12T10:00:30.000Z',
    },
  ],
  notifications: [
    {
      id: 'n1',
      type: 'booking',
      title: 'Booking confirmed',
      body: 'See you on Thursday.',
      readAt: null,
      createdAt: '2026-09-12T10:01:00.000Z',
    },
  ],
  deliverables: [
    {
      id: 'd1',
      title: 'Edited photos',
      bookingReference: 'BMD-000001',
      dueAt: null,
      deliveredAt: '2026-09-13T12:00:00.000Z',
      gallerySlug: 'wanjiku-shoot',
    },
  ],
};

describe('AccountOverviewPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('greets the customer and shows their figures, sessions, hires and payments', async () => {
    vi.spyOn(accountApi, 'fetchDashboard').mockResolvedValue(FULL);
    renderWithProviders(<AccountOverviewPage />);

    // The greeting can come from the signed-in user before the dashboard arrives,
    // so wait for the dashboard's own figures.
    const upcoming = await screen.findByRole('group', { name: 'Upcoming sessions' });
    expect(within(upcoming).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, Wanjiku' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Balance due' })).getByText(kes(300_000)),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Total paid' })).getByText(kes(450_000)),
    ).toBeInTheDocument();

    const booking = screen.getByRole('article', { name: /Podcast Recording/ });
    expect(within(booking).getByText('Confirmed')).toBeInTheDocument();
    expect(within(booking).getByText(`${kes(300_000)} due`)).toBeInTheDocument();
    expect(within(booking).getByText(/Podcast Studio A · 10:00 – 12:00/)).toBeInTheDocument();

    const hire = screen.getByRole('article', { name: 'Hire HIRE-000001' });
    expect(within(hire).getByText('Overdue')).toBeInTheDocument();
    expect(within(hire).getByText('Shure SM7B × 2')).toBeInTheDocument();

    const payments = screen.getByRole('table', { name: 'Recent payments' });
    expect(within(payments).getByText('M-Pesa')).toBeInTheDocument();
    expect(within(payments).getByText('SJK4H2L9QX')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Open gallery' })).toHaveAttribute(
      'href',
      '/gallery/wanjiku-shoot',
    );
    expect(document.title).toBe('My account · B.M.D Studio');
  });

  it('explains every empty section instead of showing a blank panel', async () => {
    vi.spyOn(accountApi, 'fetchDashboard').mockResolvedValue(EMPTY);
    renderWithProviders(<AccountOverviewPage />);

    expect(await screen.findByText('No upcoming sessions')).toBeInTheDocument();
    expect(screen.getByText('No equipment on hire')).toBeInTheDocument();
    expect(screen.getByText('No payments yet')).toBeInTheDocument();
    expect(screen.getByText('You’re all caught up')).toBeInTheDocument();
    expect(screen.getByText('Nothing to collect yet')).toBeInTheDocument();
    expect(screen.getByText('You’re all paid up')).toBeInTheDocument();
  });

  it('tells a customer whose email is unconfirmed, without offering a link that cannot work', async () => {
    vi.spyOn(accountApi, 'fetchDashboard').mockResolvedValue(EMPTY);
    renderWithProviders(<AccountOverviewPage />);

    const notice = await screen.findByRole('region', {
      name: 'Your email address isn’t confirmed yet',
    });
    expect(notice).toHaveTextContent('wanjiku@example.test');
    expect(within(notice).queryByRole('link')).not.toBeInTheDocument();
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows no confirmation notice once the email is confirmed', async () => {
    vi.spyOn(accountApi, 'fetchDashboard').mockResolvedValue({
      ...EMPTY,
      profile: { ...EMPTY.profile, emailVerified: true },
    });
    renderWithProviders(<AccountOverviewPage />);

    expect(await screen.findByText('No upcoming sessions')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Your email address isn’t confirmed yet' }),
    ).not.toBeInTheDocument();
  });

  it('reports a failure with its reference', async () => {
    vi.spyOn(accountApi, 'fetchDashboard').mockRejectedValue(
      new ApiClientError('An unexpected error occurred.', {
        code: 'INTERNAL_ERROR',
        status: 500,
        requestId: 'req-222',
      }),
    );
    renderWithProviders(<AccountOverviewPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/your account could not be loaded/i);
    expect(alert).toHaveTextContent('req-222');
  });
});
