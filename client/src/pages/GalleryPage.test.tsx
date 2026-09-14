import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicGallerySummary } from '@bmd/shared';
import * as mediaApi from '@/features/media/api';
import { ApiClientError } from '@/lib/api-client';
import { GalleryPage } from './GalleryPage';

const GALLERIES: PublicGallerySummary[] = [
  {
    slug: 'weddings',
    title: 'Weddings',
    description: 'Ceremonies and receptions.',
    type: 'PHOTO',
    itemCount: 12,
    publishedAt: '2026-09-01T00:00:00.000Z',
    cover: {
      url: 'https://media.example/weddings/cover.jpg',
      thumbnailUrl: 'https://media.example/weddings/cover@thumb.jpg',
      mimeType: 'image/jpeg',
      width: 1600,
      height: 1067,
      altText: 'Couple on the stage',
    },
  },
  {
    slug: 'studio-reel',
    title: 'Studio Reel',
    description: null,
    type: 'VIDEO',
    itemCount: 1,
    publishedAt: null,
    cover: {
      url: 'https://media.example/reel.mp4',
      thumbnailUrl: null,
      mimeType: 'video/mp4',
      width: null,
      height: null,
      altText: null,
    },
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GalleryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('links each published gallery with its cover and item count', async () => {
    vi.spyOn(mediaApi, 'fetchGalleries').mockResolvedValue(GALLERIES);
    renderPage();

    const weddings = await screen.findByRole('link', { name: /Weddings/ });
    expect(weddings).toHaveAttribute('href', '/gallery/weddings');
    expect(within(weddings).getByText('12 items')).toBeInTheDocument();
    expect(within(weddings).getByText('Photography')).toBeInTheDocument();
    expect(weddings.querySelector('img')).toHaveAttribute(
      'src',
      'https://media.example/weddings/cover@thumb.jpg',
    );

    // A video with no thumbnail gets a tile, not a broken image.
    const reel = screen.getByRole('link', { name: /Studio Reel/ });
    expect(within(reel).getByText('1 item')).toBeInTheDocument();
    expect(reel.querySelector('img')).toBeNull();
  });

  it('says so when nothing is published', async () => {
    vi.spyOn(mediaApi, 'fetchGalleries').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No galleries have been published yet')).toBeInTheDocument();
  });

  it('reports a failure with its reference and retries on request', async () => {
    const fetch = vi.spyOn(mediaApi, 'fetchGalleries').mockRejectedValue(
      new ApiClientError('Media storage is not configured.', {
        code: 'INTEGRATION_NOT_CONFIGURED',
        status: 503,
        requestId: 'req-654',
      }),
    );
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Media storage is not configured.');
    expect(alert).toHaveTextContent('req-654');

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
