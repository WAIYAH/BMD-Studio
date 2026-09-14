import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicBookingPolicy } from '@bmd/shared';
import * as legalApi from '@/features/legal/api';
import * as studioApi from '@/features/studio/api';
import { ApiClientError } from '@/lib/api-client';
import { BookingTermsPage } from './BookingTermsPage';

const POLICY: PublicBookingPolicy = {
  cancellationWindowHours: 24,
  maxAdvanceDays: 90,
  depositPercent: 50,
  lateFeePercentPerDay: 25,
  vatPercent: 16,
};

const UNSET: PublicBookingPolicy = {
  cancellationWindowHours: null,
  maxAdvanceDays: null,
  depositPercent: null,
  lateFeePercentPerDay: null,
  vatPercent: null,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingTermsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookingTermsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([]);
  });

  it("quotes the studio's configured figures", async () => {
    vi.spyOn(legalApi, 'fetchBookingPolicy').mockResolvedValue(POLICY);
    renderPage();

    expect(
      await screen.findByText(
        'You can cancel free of charge up to 24 hours before your session starts.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A deposit of 50% of the total confirms your booking.'),
    ).toBeInTheDocument();
    expect(screen.getByText('VAT at 16% is added where it applies.')).toBeInTheDocument();
    expect(
      screen.getByText('Sessions can be booked up to 90 days in advance.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Late returns are charged 25% of the item’s daily rate for each day late\./),
    ).toBeInTheDocument();
    expect(document.title).toBe('Booking & Hire Terms · B.M.D Studio');
  });

  it('describes a figure that is not configured instead of quoting one', async () => {
    vi.spyOn(legalApi, 'fetchBookingPolicy').mockResolvedValue(UNSET);
    renderPage();

    expect(
      await screen.findByText(
        'The period in which you can cancel free of charge is confirmed when you book.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('VAT is added where it applies.')).toBeInTheDocument();
    expect(
      screen.getByText('Any deposit needed to confirm your booking is set out when you book.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('says so when no deposit is needed, and uses singular units', async () => {
    vi.spyOn(legalApi, 'fetchBookingPolicy').mockResolvedValue({
      ...POLICY,
      depositPercent: 0,
      cancellationWindowHours: 1,
    });
    renderPage();

    expect(
      await screen.findByText('No deposit is needed to confirm a booking.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You can cancel free of charge up to 1 hour before your session starts.'),
    ).toBeInTheDocument();
  });

  it('shows no terms at all when their figures cannot be loaded', async () => {
    vi.spyOn(legalApi, 'fetchBookingPolicy').mockRejectedValue(
      new ApiClientError('An unexpected error occurred.', {
        code: 'INTERNAL_ERROR',
        status: 500,
        requestId: 'req-111',
      }),
    );
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/these terms could not be loaded/i);
    expect(alert).toHaveTextContent('req-111');
    expect(screen.queryByText(/free of charge/)).not.toBeInTheDocument();
  });
});
