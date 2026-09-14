import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicLiveStream, PublicOnAir } from '@bmd/shared';
import * as broadcastApi from '@/features/broadcast/api';
import { ApiClientError } from '@/lib/api-client';
import { LivePage } from './LivePage';

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

const ON_AIR: PublicOnAir = {
  timezone: 'Africa/Nairobi',
  current: {
    id: 'occ-live',
    showSlug: 'morning-drive',
    showName: 'Morning Drive',
    title: 'Budget special',
    category: 'Talk',
    startsAt: '2026-09-14T03:00:00.000Z',
    endsAt: '2026-09-14T07:00:00.000Z',
    status: 'LIVE',
    wentLiveAt: '2026-09-14T03:01:00.000Z',
  },
  next: null,
};

const STREAM: PublicLiveStream = {
  id: 'stream-1',
  title: 'Morning Drive live',
  description: null,
  showName: 'Morning Drive',
  startedAt: '2026-09-14T03:01:00.000Z',
  platforms: [
    {
      platform: 'YOUTUBE',
      watchUrl: 'https://www.youtube.com/watch?v=abc123',
      embedUrl: 'https://www.youtube.com/embed/abc123',
    },
    {
      platform: 'FACEBOOK',
      watchUrl: 'https://www.facebook.com/bmdstudio/videos/1',
      embedUrl: null,
    },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LivePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LivePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('says nothing is live and names what airs next, in studio time', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue(OFF_AIR);
    vi.spyOn(broadcastApi, 'fetchLiveStreams').mockResolvedValue([]);
    const { container } = renderPage();

    expect(await screen.findByText('Nothing is live right now')).toBeInTheDocument();
    expect(
      screen.getByText('Next on air: Evening Sessions, Monday 14 September at 18:00.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('On air')).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('embeds the live stream and links out to each platform', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue(ON_AIR);
    vi.spyOn(broadcastApi, 'fetchLiveStreams').mockResolvedValue([STREAM]);
    renderPage();

    const stream = await screen.findByRole('article', { name: 'Morning Drive live' });
    expect(within(stream).getByTitle('Morning Drive live on YouTube')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/abc123',
    );

    const facebook = within(stream).getByRole('link', { name: 'Watch on Facebook' });
    expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/bmdstudio/videos/1');
    expect(facebook).toHaveAttribute('rel', 'noopener noreferrer');

    const onAirNow = screen.getByRole('region', { name: 'On air now' });
    expect(onAirNow).toHaveTextContent('Morning Drive');
    expect(onAirNow).toHaveTextContent('Budget special');
    expect(onAirNow).toHaveTextContent('06:00 – 10:00');
  });

  it('says so when the studio is on air without a stream', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockResolvedValue(ON_AIR);
    vi.spyOn(broadcastApi, 'fetchLiveStreams').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No stream is running for this broadcast')).toBeInTheDocument();
    expect(screen.getByText('Nothing is scheduled to air yet.')).toBeInTheDocument();
  });

  it('reports a failure instead of claiming nothing is live', async () => {
    vi.spyOn(broadcastApi, 'fetchOnAir').mockRejectedValue(
      new ApiClientError('Could not reach the server.', {
        code: 'UPSTREAM_ERROR',
        status: 0,
        requestId: 'req-321',
      }),
    );
    vi.spyOn(broadcastApi, 'fetchLiveStreams').mockResolvedValue([]);
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/live status could not be loaded/i);
    expect(alert).toHaveTextContent('req-321');
    expect(screen.queryByText('Nothing is live right now')).not.toBeInTheDocument();
  });
});
