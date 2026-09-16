import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKes, type PublicEquipmentCategory } from '@bmd/shared';
import * as catalogueApi from '@/features/catalogue/api';
import { ApiClientError } from '@/lib/api-client';
import { EquipmentPage } from './EquipmentPage';

/** Testing Library collapses whitespace, including the currency's no-break space. */
const kes = (cents: number) => formatKes(cents, { withDecimals: false }).replace(/\s+/g, ' ');

const CATALOGUE: PublicEquipmentCategory[] = [
  {
    slug: 'microphones',
    name: 'Microphones',
    description: null,
    items: [
      {
        key: 'shure-sm7b-150000-1000000',
        name: 'Shure SM7B',
        description: 'Dynamic broadcast microphone.',
        manufacturer: null,
        model: null,
        dailyRateCents: 150_000,
        depositCents: 1_000_000,
        unitCount: 3,
        availableCount: 1,
      },
      {
        key: 'condenser-rode-nt1-a-120000-0',
        name: 'Condenser Mic',
        description: null,
        manufacturer: 'Rode',
        model: 'NT1-A',
        dailyRateCents: 120_000,
        depositCents: 0,
        unitCount: 2,
        availableCount: 0,
      },
    ],
  },
  {
    slug: 'lighting',
    name: 'Lighting',
    description: null,
    items: [
      {
        key: 'aputure-300d-ii-350000-2500000',
        name: 'Aputure 300D II',
        description: null,
        manufacturer: null,
        model: null,
        dailyRateCents: 350_000,
        depositCents: 2_500_000,
        unitCount: 1,
        availableCount: 1,
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
        <EquipmentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EquipmentPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while the catalogue is requested', () => {
    vi.spyOn(catalogueApi, 'fetchEquipmentCatalogue').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/loading equipment/i);
  });

  it('shows the daily rate, deposit and how many units are on the shelf', async () => {
    vi.spyOn(catalogueApi, 'fetchEquipmentCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const sm7b = await screen.findByRole('article', { name: 'Shure SM7B' });
    expect(within(sm7b).getByText(kes(150_000))).toBeInTheDocument();
    expect(within(sm7b).getByText(kes(1_000_000))).toBeInTheDocument();
    expect(within(sm7b).getByText('1 of 3 available')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lighting' })).toBeInTheDocument();
  });

  it('says plainly when every unit is out and when no deposit is taken', async () => {
    vi.spyOn(catalogueApi, 'fetchEquipmentCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const condenser = await screen.findByRole('article', { name: 'Condenser Mic' });
    expect(within(condenser).getByText('Rode NT1-A')).toBeInTheDocument();
    expect(within(condenser).getByText('None available')).toBeInTheDocument();
    expect(within(condenser).getByText('No deposit')).toBeInTheDocument();
    expect(within(condenser).queryByText(/of 2 available/)).not.toBeInTheDocument();
  });

  it('sends a visitor to the hire flow, with the chosen item already in it', async () => {
    vi.spyOn(catalogueApi, 'fetchEquipmentCatalogue').mockResolvedValue(CATALOGUE);
    renderPage();

    const sm7b = await screen.findByRole('article', { name: 'Shure SM7B' });
    expect(within(sm7b).getByRole('link', { name: 'Add to a hire' })).toHaveAttribute(
      'href',
      `/hire?items=${encodeURIComponent('shure-sm7b-150000-1000000:1')}`,
    );
    expect(screen.getByRole('link', { name: 'Request a hire' })).toHaveAttribute('href', '/hire');
  });

  it('reports a failure with its reference', async () => {
    vi.spyOn(catalogueApi, 'fetchEquipmentCatalogue').mockRejectedValue(
      new ApiClientError('Could not reach the server.', {
        code: 'UPSTREAM_ERROR',
        status: 0,
        requestId: 'req-456',
      }),
    );
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/equipment could not be loaded/i);
    expect(alert).toHaveTextContent('req-456');
  });

  it('says so when nothing is listed', async () => {
    vi.spyOn(catalogueApi, 'fetchEquipmentCatalogue').mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No equipment is listed for hire')).toBeInTheDocument();
  });
});
