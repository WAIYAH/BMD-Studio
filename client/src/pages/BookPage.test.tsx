import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatKes,
  type AvailabilityDay,
  type BookingDetail,
  type BookingQuote,
  type PublicServiceCategory,
} from '@bmd/shared';
import * as bookingApi from '@/features/booking/api';
import * as catalogueApi from '@/features/catalogue/api';
import { LocationDisplay, authValue, renderWithProviders } from '@/test/render';
import { BookPage } from './BookPage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const CATALOGUE: PublicServiceCategory[] = [
  {
    slug: 'podcast',
    name: 'Podcast Production',
    description: null,
    services: [
      {
        slug: 'podcast-recording',
        name: 'Podcast Recording',
        description: 'Multi-mic recording.',
        pricingModel: 'HOURLY',
        basePriceCents: 250_000,
        fromPriceCents: 250_000,
        minDurationMinutes: 60,
        maxDurationMinutes: 180,
        slotIntervalMinutes: 30,
        requiresApproval: false,
        rooms: [{ slug: 'podcast-a', name: 'Podcast Studio A', capacity: 4, priceCents: 250_000 }],
        packages: [],
      },
    ],
  },
];

/** 07:00Z is 10:00 in Nairobi, which is what a customer sees. */
const DAY: AvailabilityDay = {
  date: '2026-09-20',
  timezone: 'Africa/Nairobi',
  serviceSlug: 'podcast-recording',
  roomSlug: 'podcast-a',
  durationMinutes: 60,
  isOpen: true,
  closedReason: null,
  opensAt: '2026-09-20T05:00:00.000Z',
  closesAt: '2026-09-20T17:00:00.000Z',
  slots: [
    {
      startsAt: '2026-09-20T07:00:00.000Z',
      endsAt: '2026-09-20T08:00:00.000Z',
      available: true,
      blockedBy: null,
    },
    {
      startsAt: '2026-09-20T08:00:00.000Z',
      endsAt: '2026-09-20T09:00:00.000Z',
      available: false,
      blockedBy: 'BOOKED',
    },
  ],
};

const QUOTE: BookingQuote = {
  serviceSlug: 'podcast-recording',
  serviceName: 'Podcast Recording',
  roomSlug: 'podcast-a',
  roomName: 'Podcast Studio A',
  studioName: 'B.M.D Studio',
  pricingModel: 'HOURLY',
  packageName: null,
  startsAt: '2026-09-20T07:00:00.000Z',
  endsAt: '2026-09-20T08:00:00.000Z',
  durationMinutes: 60,
  timezone: 'Africa/Nairobi',
  lines: [
    {
      kind: 'SERVICE',
      label: 'Podcast Recording in Podcast Studio A',
      quantity: 1,
      unitPriceCents: 250_000,
      totalCents: 250_000,
    },
  ],
  subtotalCents: 250_000,
  taxCents: 40_000,
  totalCents: 290_000,
  depositCents: 145_000,
  vatPercent: 16,
  depositPercent: 50,
  requiresApproval: false,
  cancellationWindowHours: 24,
  paymentHoldMinutes: 30,
  available: true,
  blockedBy: null,
};

const CHOSEN = '/book?service=podcast-recording&room=podcast-a&date=2026-09-20&duration=60';
const AT_REVIEW = `${CHOSEN}&start=2026-09-20T07%3A00%3A00.000Z`;

describe('BookPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue(CATALOGUE);
    vi.spyOn(bookingApi, 'fetchAvailability').mockResolvedValue(DAY);
    vi.spyOn(bookingApi, 'fetchQuote').mockResolvedValue(QUOTE);
  });

  it('offers the bookable services first', async () => {
    renderWithProviders(<BookPage />, { route: '/book' });

    expect(await screen.findByRole('button', { name: /Podcast Recording/ })).toBeInTheDocument();
    expect(screen.getByText('1. Service').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('shows free start times and refuses the taken ones', async () => {
    renderWithProviders(<BookPage />, { route: CHOSEN });

    expect(await screen.findByRole('button', { name: '10:00' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /11:00/ })).toBeDisabled();
    expect(screen.getByText(/1 of 2 start times are free/)).toBeInTheDocument();
  });

  it('shows the server’s price, and asks a visitor to sign in before confirming', async () => {
    renderWithProviders(<BookPage />, {
      route: AT_REVIEW,
      auth: authValue({ status: 'anonymous', user: null }),
    });

    expect(await screen.findByText(kes(290_000))).toBeInTheDocument();
    // The deposit is shown twice: in the price summary, and in the sentence
    // about how long the room is held for it.
    expect(screen.getAllByText(kes(145_000))).toHaveLength(2);
    expect(screen.getByText(/Free cancellation up to 24 hours/)).toBeInTheDocument();

    const signIn = screen.getByRole('link', { name: 'Sign in to confirm' });
    expect(signIn).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument();
  });

  it('will not confirm until the booking terms are accepted', async () => {
    const create = vi.spyOn(bookingApi, 'createBooking');
    renderWithProviders(<BookPage />, { route: AT_REVIEW });

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm booking' }));

    expect(
      await screen.findByText('Accept the Booking & Hire Terms to confirm.'),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('books the slot and opens the new booking', async () => {
    const create = vi
      .spyOn(bookingApi, 'createBooking')
      .mockResolvedValue({ id: 'bk-1' } as BookingDetail);
    renderWithProviders(
      <>
        <BookPage />
        <LocationDisplay />
      </>,
      { route: AT_REVIEW },
    );

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      service: 'podcast-recording',
      room: 'podcast-a',
      startsAt: '2026-09-20T07:00:00.000Z',
      durationMinutes: 60,
      acceptTerms: true,
    });
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/account/bookings/bk-1'),
    );
  });

  it('says so when the slot is taken between choosing and confirming', async () => {
    vi.spyOn(bookingApi, 'fetchQuote').mockResolvedValue({
      ...QUOTE,
      available: false,
      blockedBy: 'BOOKED',
    });
    renderWithProviders(<BookPage />, { route: AT_REVIEW });

    expect(await screen.findByText(/That time has just been taken/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
  });
});
