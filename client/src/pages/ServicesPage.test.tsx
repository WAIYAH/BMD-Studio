import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKes, type PublicServiceCategory } from '@bmd/shared';
import * as catalogueApi from '@/features/catalogue/api';
import { ApiClientError } from '@/lib/api-client';
import { ServicesPage } from './ServicesPage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const CATALOGUE: PublicServiceCategory[] = [
  {
    slug: 'broadcast',
    name: 'Radio & Broadcast',
    description: null,
    services: [
      {
        slug: 'live-radio-slot',
        name: 'Live Radio Slot',
        description: 'Hosted live broadcast slot.',
        pricingModel: 'HOURLY',
        basePriceCents: 350_000,
        fromPriceCents: 350_000,
        minDurationMinutes: 60,
        maxDurationMinutes: 240,
        slotIntervalMinutes: 30,
        requiresApproval: true,
        rooms: [
          { slug: 'live-room', name: 'Live Broadcast Room', capacity: 4, priceCents: 350_000 },
        ],
        packages: [],
      },
    ],
  },
  {
    slug: 'podcast',
    name: 'Podcast Production',
    description: 'Recorded shows and voice work.',
    services: [
      {
        slug: 'podcast-recording',
        name: 'Podcast Recording',
        description: null,
        pricingModel: 'HOURLY',
        basePriceCents: 250_000,
        fromPriceCents: 180_000,
        minDurationMinutes: 60,
        maxDurationMinutes: 300,
        slotIntervalMinutes: 30,
        requiresApproval: false,
        rooms: [
          { slug: 'podcast-a', name: 'Podcast Studio A', capacity: 4, priceCents: 250_000 },
          { slug: 'podcast-b', name: 'Podcast Studio B', capacity: 2, priceCents: 180_000 },
        ],
        packages: [],
      },
    ],
  },
  {
    slug: 'photography',
    name: 'Photography & Video',
    description: null,
    services: [
      {
        slug: 'studio-portrait',
        name: 'Studio Portrait Session',
        description: null,
        pricingModel: 'PACKAGE',
        basePriceCents: 1_200_000,
        fromPriceCents: 1_200_000,
        minDurationMinutes: 60,
        maxDurationMinutes: 240,
        slotIntervalMinutes: 60,
        requiresApproval: false,
        rooms: [
          { slug: 'photo-stage', name: 'Photography Stage', capacity: 10, priceCents: 1_200_000 },
        ],
        packages: [
          {
            id: 'pkg-essential',
            name: 'Portrait — Essential',
            description: null,
            deliverableCount: 10,
            editTurnaroundDays: 5,
            priceCents: 1_200_000,
          },
          {
            id: 'pkg-extended',
            name: 'Portrait — Extended',
            description: null,
            deliverableCount: 25,
            editTurnaroundDays: 7,
            priceCents: 2_200_000,
          },
        ],
      },
    ],
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServicesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while the catalogue is requested', () => {
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/loading services/i);
  });

  it('renders every category with jump links', async () => {
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const nav = await screen.findByRole('navigation', { name: 'Service categories' });
    expect(within(nav).getByRole('link', { name: 'Podcast Production' })).toHaveAttribute(
      'href',
      '#category-podcast',
    );
    for (const category of CATALOGUE) {
      expect(screen.getByRole('heading', { level: 2, name: category.name })).toBeInTheDocument();
    }
  });

  it('shows per-room prices and a "from" price only when rooms are priced differently', async () => {
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const podcast = await screen.findByRole('article', { name: 'Podcast Recording' });
    expect(within(podcast).getByText('From')).toBeInTheDocument();
    expect(within(podcast).getAllByText(kes(180_000))).toHaveLength(2);
    expect(within(podcast).getByText(kes(250_000))).toBeInTheDocument();
    expect(within(podcast).getByText('per hour')).toBeInTheDocument();
    expect(within(podcast).getByText('1 hr – 5 hrs')).toBeInTheDocument();

    const radio = screen.getByRole('article', { name: 'Live Radio Slot' });
    expect(within(radio).queryByText('From')).not.toBeInTheDocument();
    expect(within(radio).getAllByText(kes(350_000))).toHaveLength(1);
    expect(within(radio).getByText('Approval required')).toBeInTheDocument();
    expect(within(podcast).queryByText('Approval required')).not.toBeInTheDocument();
  });

  it('lists photography packages with their deliverable terms', async () => {
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const portrait = await screen.findByRole('article', { name: 'Studio Portrait Session' });
    expect(within(portrait).getByText('Portrait — Extended')).toBeInTheDocument();
    expect(within(portrait).getByText('25 edited photos · 7-day turnaround')).toBeInTheDocument();
    expect(within(portrait).getByText(kes(2_200_000))).toBeInTheDocument();
    expect(within(portrait).getByText('per package')).toBeInTheDocument();
  });

  it('reports a failure with its reference and retries on request', async () => {
    const fetch = vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockRejectedValue(
      new ApiClientError('An unexpected error occurred.', {
        code: 'INTERNAL_ERROR',
        status: 500,
        requestId: 'req-789',
      }),
    );
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/services could not be loaded/i);
    expect(alert).toHaveTextContent('req-789');

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('says so when nothing is bookable', async () => {
    vi.spyOn(catalogueApi, 'fetchServiceCatalogue').mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No services are open for booking')).toBeInTheDocument();
  });
});
