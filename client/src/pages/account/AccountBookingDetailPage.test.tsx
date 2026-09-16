import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { formatKes, type BookingDetail } from '@bmd/shared';
import * as bookingApi from '@/features/booking/api';
import { renderWithProviders } from '@/test/render';
import { AccountBookingDetailPage } from './AccountBookingDetailPage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const BOOKING: BookingDetail = {
  id: 'bk-1',
  reference: 'BMD-7QF2K9',
  status: 'CONFIRMED',
  startsAt: '2026-09-20T07:00:00.000Z',
  endsAt: '2026-09-20T09:00:00.000Z',
  studioName: 'B.M.D Studio',
  roomName: 'Podcast Studio A',
  serviceName: 'Podcast Recording',
  totalCents: 580_000,
  paidCents: 290_000,
  timezone: 'Africa/Nairobi',
  serviceSlug: 'podcast-recording',
  roomSlug: 'podcast-a',
  durationMinutes: 120,
  packageName: null,
  notes: 'Two guests joining.',
  subtotalCents: 500_000,
  taxCents: 80_000,
  depositCents: 290_000,
  balanceCents: 290_000,
  holdExpiresAt: null,
  requiresApproval: false,
  createdAt: '2026-09-14T09:00:00.000Z',
  items: [
    {
      id: 'item-1',
      kind: 'SERVICE',
      label: 'Podcast Recording in Podcast Studio A',
      quantity: 1,
      unitPriceCents: 500_000,
      totalCents: 500_000,
    },
  ],
  history: [
    {
      status: 'PENDING_PAYMENT',
      previousStatus: null,
      reason: 'Booked online',
      at: '2026-09-14T09:00:00.000Z',
      byYou: true,
    },
    {
      status: 'CONFIRMED',
      previousStatus: 'PENDING_PAYMENT',
      reason: 'Deposit received',
      at: '2026-09-14T09:05:00.000Z',
      byYou: false,
    },
  ],
  payments: [
    {
      id: 'pay-1',
      reference: 'PAY-001',
      status: 'SUCCESSFUL',
      provider: 'MPESA',
      purpose: 'BOOKING',
      amountCents: 290_000,
      receiptNumber: 'SJK4H2L9QX',
      createdAt: '2026-09-14T09:04:00.000Z',
      paidAt: '2026-09-14T09:05:00.000Z',
    },
  ],
  deliverables: [],
  cancellation: {
    allowed: true,
    reason: null,
    free: true,
    freeUntil: '2026-09-19T07:00:00.000Z',
    refundableCents: 290_000,
  },
  reschedule: { allowed: true, reason: null },
  movedFromReference: null,
  movedToReference: null,
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/account/bookings/:id" element={<AccountBookingDetailPage />} />
    </Routes>,
    { route: '/account/bookings/bk-1' },
  );
}

describe('AccountBookingDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(bookingApi, 'fetchBooking').mockResolvedValue(BOOKING);
  });

  it('shows the session, what it cost and what has happened to it', async () => {
    renderDetail();

    expect(await screen.findByText('BMD-7QF2K9')).toBeInTheDocument();
    // Once as the status badge, once as the event that put it there.
    expect(screen.getAllByText('Confirmed')).toHaveLength(2);
    expect(screen.getByText('10:00 – 12:00 · 2 hrs')).toBeInTheDocument();
    expect(screen.getByText('Two guests joining.')).toBeInTheDocument();

    const costs = screen.getByRole('region', { name: 'What it costs' });
    expect(within(costs).getByText(kes(580_000))).toBeInTheDocument();
    // The deposit already paid, and the same amount still to pay.
    expect(within(costs).getAllByText(kes(290_000))).toHaveLength(2);

    const payments = screen.getByRole('table', { name: 'Payments for this booking' });
    expect(within(payments).getByText('SJK4H2L9QX')).toBeInTheDocument();

    const history = screen.getByRole('region', { name: 'What happened' });
    expect(within(history).getByText('Deposit received')).toBeInTheDocument();
  });

  it('warns that an unpaid booking only holds the room for a while', async () => {
    vi.spyOn(bookingApi, 'fetchBooking').mockResolvedValue({
      ...BOOKING,
      status: 'PENDING_PAYMENT',
      paidCents: 0,
      holdExpiresAt: '2026-09-14T09:30:00.000Z',
    });
    renderDetail();

    expect(await screen.findByText(/This room is held until/)).toBeInTheDocument();
  });

  it('says what a free cancellation refunds before doing it', async () => {
    const cancel = vi
      .spyOn(bookingApi, 'cancelBooking')
      .mockResolvedValue({ ...BOOKING, status: 'CANCELLED' });
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('inside the free cancellation period');
    expect(dialog).toHaveTextContent(kes(290_000));

    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Plans changed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('bk-1', { reason: 'Plans changed' }));
  });

  it('warns that a late cancellation is not refunded', async () => {
    vi.spyOn(bookingApi, 'fetchBooking').mockResolvedValue({
      ...BOOKING,
      cancellation: {
        allowed: true,
        reason: null,
        free: false,
        freeUntil: '2026-09-19T07:00:00.000Z',
        refundableCents: 0,
      },
      reschedule: { allowed: false, reason: 'Sessions can be moved up to 24 hours before.' },
    });
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('free cancellation period has passed');
    expect(dialog).toHaveTextContent('not refunded');
  });

  it('explains why a closed booking offers no actions', async () => {
    vi.spyOn(bookingApi, 'fetchBooking').mockResolvedValue({
      ...BOOKING,
      status: 'CANCELLED',
      cancellation: {
        allowed: false,
        reason: 'This booking is already closed.',
        free: false,
        freeUntil: null,
        refundableCents: 0,
      },
      reschedule: { allowed: false, reason: 'This booking is already closed.' },
    });
    renderDetail();

    expect(await screen.findByText(/This booking is already closed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Move to another time' })).not.toBeInTheDocument();
  });
});
