import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatKes,
  type EquipmentAvailability,
  type HireQuote,
  type RentalDetail,
} from '@bmd/shared';
import * as rentalApi from '@/features/rental/api';
import { LocationDisplay, authValue, renderWithProviders } from '@/test/render';
import { HirePage } from './HirePage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const MIC_KEY = 'shure-sm7b-150000-1000000';
const CAMERA_KEY = 'canon-eos-r6-650000-5500000';

const AVAILABILITY: EquipmentAvailability = {
  from: '2026-09-20',
  to: '2026-09-21',
  days: 2,
  timezone: 'Africa/Nairobi',
  closedOn: [],
  items: [
    {
      key: MIC_KEY,
      name: 'Shure SM7B',
      unitCount: 3,
      availableCount: 2,
      dailyRateCents: 150_000,
      depositCents: 1_000_000,
    },
    {
      key: CAMERA_KEY,
      name: 'Canon EOS R6',
      unitCount: 1,
      availableCount: 0,
      dailyRateCents: 650_000,
      depositCents: 5_500_000,
    },
  ],
};

const QUOTE: HireQuote = {
  from: '2026-09-20',
  to: '2026-09-21',
  days: 2,
  timezone: 'Africa/Nairobi',
  lines: [
    {
      key: MIC_KEY,
      label: 'Shure SM7B',
      quantity: 2,
      availableCount: 2,
      dailyRateCents: 150_000,
      totalCents: 600_000,
      depositCents: 2_000_000,
    },
  ],
  subtotalCents: 600_000,
  taxCents: 96_000,
  depositCents: 2_000_000,
  totalCents: 2_696_000,
  vatPercent: 16,
  available: true,
  unavailableKeys: [],
  closedOn: [],
};

const DATES = '/hire?from=2026-09-20&to=2026-09-21';
const WITH_KIT = `${DATES}&items=${encodeURIComponent(`${MIC_KEY}:2`)}`;

describe('HirePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rentalApi, 'fetchEquipmentAvailability').mockResolvedValue(AVAILABILITY);
    vi.spyOn(rentalApi, 'fetchHireQuote').mockResolvedValue(QUOTE);
  });

  it('shows what is free, and will not let you add what is not', async () => {
    renderWithProviders(<HirePage />, { route: DATES });

    expect(await screen.findByText('2 free')).toBeInTheDocument();
    expect(screen.getByText('None free')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'One more Shure SM7B' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'One more Canon EOS R6' })).toBeDisabled();
    expect(screen.getByText('2 days, charged per day.')).toBeInTheDocument();
  });

  it('prices the chosen kit, showing the deposit separately from the hire', async () => {
    renderWithProviders(<HirePage />, { route: WITH_KIT });

    const summary = await screen.findByRole('region', { name: 'Your hire' });
    // Once as the line for the microphones, once as the hire subtotal.
    expect(within(summary).getAllByText(kes(600_000))).toHaveLength(2);
    expect(within(summary).getByText(kes(96_000))).toBeInTheDocument();
    expect(within(summary).getByText(kes(2_000_000))).toBeInTheDocument();
    expect(within(summary).getByText(kes(2_696_000))).toBeInTheDocument();
    expect(within(summary).getByText(/staff check every request/i)).toBeInTheDocument();
  });

  it('asks a visitor to sign in before requesting', async () => {
    renderWithProviders(<HirePage />, {
      route: WITH_KIT,
      auth: authValue({ status: 'anonymous', user: null }),
    });

    expect(await screen.findByRole('link', { name: 'Sign in to request' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.queryByRole('button', { name: 'Request this hire' })).not.toBeInTheDocument();
  });

  it('sends the request and opens the new hire', async () => {
    const create = vi
      .spyOn(rentalApi, 'createRental')
      .mockResolvedValue({ id: 'hire-1' } as RentalDetail);
    renderWithProviders(
      <>
        <HirePage />
        <LocationDisplay />
      </>,
      { route: WITH_KIT },
    );

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Request this hire' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      from: '2026-09-20',
      to: '2026-09-21',
      items: [{ key: MIC_KEY, quantity: 2 }],
      acceptTerms: true,
    });
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/account/rentals/hire-1'),
    );
  });

  it('will not request a hire until the terms are accepted', async () => {
    const create = vi.spyOn(rentalApi, 'createRental');
    renderWithProviders(<HirePage />, { route: WITH_KIT });

    await userEvent.click(await screen.findByRole('button', { name: 'Request this hire' }));

    expect(
      await screen.findByText('Accept the Booking & Hire Terms to request a hire.'),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('says when the studio is shut on a handover day', async () => {
    vi.spyOn(rentalApi, 'fetchEquipmentAvailability').mockResolvedValue({
      ...AVAILABILITY,
      closedOn: ['2026-09-20'],
      items: AVAILABILITY.items.map((item) => ({ ...item, availableCount: 0 })),
    });
    renderWithProviders(<HirePage />, { route: DATES });

    expect(await screen.findByText(/The studio is closed on 2026-09-20/)).toBeInTheDocument();
  });
});
