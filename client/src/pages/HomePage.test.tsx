import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKes, type PublicOnAir, type PublicServiceCategory } from '@bmd/shared';
import * as broadcastApi from '@/features/broadcast/api';
import * as catalogueApi from '@/features/catalogue/api';
import { ApiClientError } from '@/lib/api-client';
import { HomePage } from './HomePage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const OFF_AIR: PublicOnAir = {
  timezone: 'Africa/Nairobi',
  current: null,
  next: {
    id: 'occ-next',
    showSlug: 'evening-sessions',
    showName: 'Evening Sessions',
    title: null,
    category: 'Live',
    startsAt: '2026-09-14T15:00:00.000Z',
    endsAt: '2026-09-14T17:00:00.000Z',
    status: 'SCHEDULED',
  },
};

const service = (slug: string, name: string, priceCents: number) => ({
  slug,
  name,
  description: null,
  pricingModel: 'HOURLY' as const,
  basePriceCents: priceCents,
  fromPriceCents: priceCents,
  minDurationMinutes: 60,
  maxDurationMinutes: 240,
  slotIntervalMinutes: 30,
  requiresApproval: false,
  rooms: [{ slug: `${slug}-room`, name: 'Room', capacity: 4, priceCents }],
  packages: [],
});

const CATALOGUE: PublicServiceCategory[] = [
  {
    slug: 'broadcast',
    name: 'Radio & Broadcast',
    description: null,
    services: [
      service('live-radio-slot', 'Live Radio Slot', 350_000),
      service('second-broadcast', 'Second Broadcast Service', 100_000),
    ],
  },
  {
    slug: 'podcast',
    name: 'Podcast Production',
    description: null,
    services: [service('podcast-recording', 'Podcast Recording', 250_000)],
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows what airs next and one headline service per category', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue(OFF_AIR);
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const panel = screen.getByRole('complementary', { name: 'Studio radio' });
    expect(await within(panel).findByText('Evening Sessions')).toBeInTheDocument();
    expect(within(panel).getByText('Monday 14 September · 18:00')).toBeInTheDocument();
    expect(within(panel).queryByText('On air')).not.toBeInTheDocument();

    const radio = await screen.findByRole('article', { name: 'Live Radio Slot' });
    expect(within(radio).getByText(kes(350_000))).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Podcast Recording' })).toBeInTheDocument();
    expect(
      screen.queryByRole('article', { name: 'Second Broadcast Service' }),
    ).not.toBeInTheDocument();

    expect(screen.queryByText(/system status/i)).not.toBeInTheDocument();
    expect(document.title).toBe('B.M.D Studio — Broadcast, Podcast & Media Production, Kenya');
  });

  it('marks the show an operator has on air', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue({
      timezone: 'Africa/Nairobi',
      next: null,
      current: {
        id: 'occ-live',
        showSlug: 'morning-drive',
        showName: 'Morning Drive',
        title: null,
        category: 'Talk',
        startsAt: '2026-09-14T03:00:00.000Z',
        endsAt: '2026-09-14T07:00:00.000Z',
        status: 'LIVE',
        wentLiveAt: '2026-09-14T03:01:00.000Z',
      },
    });
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue([]);
    renderPage();

    const panel = screen.getByRole('complementary', { name: 'Studio radio' });
    expect(await within(panel).findByText('Morning Drive')).toBeInTheDocument();
    expect(within(panel).getByText('On air')).toBeInTheDocument();
    expect(within(panel).getByText('06:00 – 10:00')).toBeInTheDocument();
  });

  it('stays usable when the live schedule cannot be read', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockRejectedValue(
      new ApiClientError('Could not reach the server.', { code: 'UPSTREAM_ERROR', status: 0 }),
    );
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    expect(
      await screen.findByText('The live schedule is unavailable right now.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Live Radio Slot' })).toBeInTheDocument();
  });
});
