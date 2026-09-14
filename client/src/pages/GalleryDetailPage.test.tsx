import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicGallery } from '@bmd/shared';
import * as mediaApi from '@/features/media/api';
import { ApiClientError } from '@/lib/api-client';
import { GalleryDetailPage } from './GalleryDetailPage';

const GALLERY: PublicGallery = {
  slug: 'studio-reel',
  title: 'Studio Reel',
  description: 'Behind the scenes at B.M.D.',
  type: 'VIDEO',
  publishedAt: '2026-09-02T00:00:00.000Z',
  items: [
    {
      id: 'item-photo',
      caption: 'Morning Drive in the studio',
      media: {
        url: 'https://media.example/desk.jpg',
        thumbnailUrl: 'https://media.example/desk@thumb.jpg',
        mimeType: 'image/jpeg',
        width: 1600,
        height: 1067,
        altText: 'The live desk',
      },
    },
    {
      id: 'item-video',
      caption: null,
      media: {
        url: 'https://media.example/reel.mp4',
        thumbnailUrl: null,
        mimeType: 'video/mp4',
        width: null,
        height: null,
        altText: null,
      },
    },
  ],
};

function renderAt(slug: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/gallery/${slug}`]}>
        <Routes>
          <Route path="/gallery/:slug" element={<GalleryDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GalleryDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows photos that open full size and plays video inline', async () => {
    const fetch = vi.spyOn(mediaApi, 'fetchGallery').mockResolvedValue(GALLERY);
    const { container } = renderAt('studio-reel');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Studio Reel' }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('studio-reel');

    const photo = screen.getByRole('img', { name: 'The live desk' });
    expect(photo).toHaveAttribute('src', 'https://media.example/desk@thumb.jpg');
    expect(photo.closest('a')).toHaveAttribute('href', 'https://media.example/desk.jpg');
    expect(screen.getByText('Morning Drive in the studio')).toBeInTheDocument();

    expect(container.querySelector('video')).toHaveAttribute(
      'src',
      'https://media.example/reel.mp4',
    );
  });

  it('says the gallery was not found when it is missing or unpublished', async () => {
    vi.spyOn(mediaApi, 'fetchGallery').mockRejectedValue(
      new ApiClientError('Gallery was not found.', { code: 'NOT_FOUND', status: 404 }),
    );
    renderAt('draft');

    expect(await screen.findByText('Gallery not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All galleries' })).toHaveAttribute('href', '/gallery');
  });
});
