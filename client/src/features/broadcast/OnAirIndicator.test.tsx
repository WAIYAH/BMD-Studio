import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicOnAir } from '@bmd/shared';
import { ApiClientError } from '@/lib/api-client';
import * as broadcastApi from './api';
import { OnAirIndicator } from './OnAirIndicator';

const OFF_AIR: PublicOnAir = { timezone: 'Africa/Nairobi', current: null, next: null };

function renderIndicator() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OnAirIndicator />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnAirIndicator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while off air', async () => {
    const fetch = vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue(OFF_AIR);
    const { container } = renderIndicator();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('lights up and links to the live page when an operator is on air', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue({
      ...OFF_AIR,
      current: {
        id: 'occ-1',
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
    renderIndicator();

    const link = await screen.findByRole('link', { name: 'On air now: Morning Drive' });
    expect(link).toHaveAttribute('href', '/live');
  });

  it('renders nothing when the state cannot be read', async () => {
    const fetch = vi
      .spyOn(broadcastApi, 'fetchOnAir')
      .mockRejectedValue(
        new ApiClientError('Could not reach the server.', { code: 'UPSTREAM_ERROR', status: 0 }),
      );
    const { container } = renderIndicator();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
