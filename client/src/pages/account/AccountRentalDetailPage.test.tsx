import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { formatKes, type RentalDetail } from '@bmd/shared';
import * as rentalApi from '@/features/rental/api';
import { renderWithProviders } from '@/test/render';
import { AccountRentalDetailPage } from './AccountRentalDetailPage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const RENTAL: RentalDetail = {
  id: 'hire-1',
  reference: 'HIRE-4K2P8M',
  status: 'PENDING_APPROVAL',
  startsAt: '2026-09-20T05:00:00.000Z',
  endsAt: '2026-09-21T17:00:00.000Z',
  totalCents: 2_696_000,
  paidCents: 0,
  isOverdue: false,
  items: ['Shure SM7B × 2'],
  timezone: 'Africa/Nairobi',
  days: 2,
  notes: 'Collecting at nine.',
  subtotalCents: 600_000,
  taxCents: 96_000,
  depositCents: 2_000_000,
  lateFeeCents: 0,
  damageFeeCents: 0,
  balanceCents: 2_696_000,
  createdAt: '2026-09-16T09:00:00.000Z',
  approvedAt: null,
  rejectedReason: null,
  checkedOutAt: null,
  returnedAt: null,
  lines: [
    {
      key: 'shure-sm7b-150000-1000000',
      name: 'Shure SM7B',
      quantity: 2,
      dailyRateCents: 150_000,
      totalCents: 600_000,
      depositCents: 2_000_000,
    },
  ],
  payments: [],
  cancellation: {
    allowed: true,
    reason: null,
    free: true,
    freeUntil: '2026-09-19T05:00:00.000Z',
    refundableCents: 0,
  },
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/account/rentals/:id" element={<AccountRentalDetailPage />} />
    </Routes>,
    { route: '/account/rentals/hire-1' },
  );
}

describe('AccountRentalDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rentalApi, 'fetchRental').mockResolvedValue(RENTAL);
  });

  it('shows the kit, the dates and what it costs, with the deposit called out', async () => {
    renderDetail();

    expect(await screen.findByText('HIRE-4K2P8M')).toBeInTheDocument();
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText(/staff are checking this request/i)).toBeInTheDocument();

    const kit = screen.getByRole('region', { name: 'Equipment' });
    expect(within(kit).getByText('Shure SM7B × 2')).toBeInTheDocument();
    expect(within(kit).getByText('Collecting at nine.')).toBeInTheDocument();

    const costs = screen.getByRole('region', { name: 'What it costs' });
    expect(within(costs).getByText('Deposit (refundable)')).toBeInTheDocument();
    expect(within(costs).getByText(kes(2_000_000))).toBeInTheDocument();
    expect(within(costs).getAllByText(kes(2_696_000))).toHaveLength(2);
  });

  it('cancels a hire that has not been collected', async () => {
    const cancel = vi
      .spyOn(rentalApi, 'cancelRental')
      .mockResolvedValue({ ...RENTAL, status: 'CANCELLED' });
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this hire' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('nothing to refund');

    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Shoot postponed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel hire' }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith('hire-1', { reason: 'Shoot postponed' }),
    );
  });

  it('offers a refund when a paid hire is cancelled in time', async () => {
    vi.spyOn(rentalApi, 'fetchRental').mockResolvedValue({
      ...RENTAL,
      status: 'APPROVED',
      paidCents: 2_696_000,
      balanceCents: 0,
      cancellation: { ...RENTAL.cancellation, refundableCents: 2_696_000 },
    });
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this hire' }));

    expect(screen.getByRole('dialog')).toHaveTextContent(kes(2_696_000));
  });

  it('explains why equipment already collected cannot be cancelled here', async () => {
    vi.spyOn(rentalApi, 'fetchRental').mockResolvedValue({
      ...RENTAL,
      status: 'CHECKED_OUT',
      checkedOutAt: '2026-09-20T06:00:00.000Z',
      cancellation: {
        allowed: false,
        reason: 'This hire can no longer be cancelled online.',
        free: false,
        freeUntil: null,
        refundableCents: 0,
      },
    });
    renderDetail();

    expect(await screen.findByText(/can no longer be cancelled online/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel this hire' })).not.toBeInTheDocument();
  });

  it('says why a hire was turned down', async () => {
    vi.spyOn(rentalApi, 'fetchRental').mockResolvedValue({
      ...RENTAL,
      status: 'REJECTED',
      rejectedReason: 'The camera is booked for a shoot that week.',
      cancellation: {
        allowed: false,
        reason: 'This hire can no longer be cancelled online.',
        free: false,
        freeUntil: null,
        refundableCents: 0,
      },
    });
    renderDetail();

    expect(
      await screen.findByText(/The camera is booked for a shoot that week./),
    ).toBeInTheDocument();
  });
});
