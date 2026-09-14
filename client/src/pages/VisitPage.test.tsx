import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicStudio } from '@bmd/shared';
import * as studioApi from '@/features/studio/api';
import { ApiClientError } from '@/lib/api-client';
import { VisitPage } from './VisitPage';

const STUDIO: PublicStudio = {
  slug: 'bmd-nairobi',
  name: 'B.M.D Studio',
  branch: 'Nairobi',
  description: 'Radio, podcast, live streaming and photography studio.',
  addressLine: 'Ngong Road',
  city: 'Nairobi',
  county: 'Nairobi',
  phone: '+254700000000',
  email: 'hello@studio.test',
  location: { latitude: -1.2921, longitude: 36.8219 },
  timezone: 'Africa/Nairobi',
  hours: [
    { weekday: 1, isClosed: false, openMinute: 480, closeMinute: 1200 },
    { weekday: 6, isClosed: false, openMinute: 600, closeMinute: 960 },
    { weekday: 0, isClosed: true },
  ],
  rooms: [
    { slug: 'live-room', name: 'Live Broadcast Room', description: 'On-air desk.', capacity: 4 },
    { slug: 'booth', name: 'Voice Booth', description: null, capacity: 1 },
  ],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VisitPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VisitPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists opening hours in the order the API gives, marking closed days', async () => {
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([STUDIO]);
    renderPage();

    const hours = await screen.findByRole('region', { name: 'Opening hours' });
    expect(
      within(hours)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Monday', 'Saturday', 'Sunday']);
    expect(within(hours).getByText('08:00 – 20:00')).toBeInTheDocument();
    expect(within(hours).getByText('Closed')).toBeInTheDocument();
    expect(document.title).toBe('Visit the studio · B.M.D Studio');
  });

  it('links phone, email and map, and lists the open rooms', async () => {
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([STUDIO]);
    renderPage();

    const findUs = await screen.findByRole('region', { name: 'Find us' });
    expect(within(findUs).getByText('Ngong Road, Nairobi')).toBeInTheDocument();
    expect(within(findUs).getByRole('link', { name: '+254700000000' })).toHaveAttribute(
      'href',
      'tel:+254700000000',
    );
    expect(within(findUs).getByRole('link', { name: 'hello@studio.test' })).toHaveAttribute(
      'href',
      'mailto:hello@studio.test',
    );
    expect(within(findUs).getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-1.2921,36.8219',
    );

    expect(screen.getByText('Up to 4 people')).toBeInTheDocument();
    expect(screen.getByText('Up to 1 person')).toBeInTheDocument();
  });

  it('says so rather than inventing contact details that were never published', async () => {
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([
      {
        ...STUDIO,
        addressLine: null,
        city: null,
        county: null,
        phone: null,
        email: null,
        location: null,
        hours: [],
      },
    ]);
    renderPage();

    const findUs = await screen.findByRole('region', { name: 'Find us' });
    expect(
      within(findUs).getByText('Contact details have not been published yet.'),
    ).toBeInTheDocument();
    expect(within(findUs).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Opening hours have not been published yet.')).toBeInTheDocument();
  });

  it('reports a failure with its reference', async () => {
    vi.spyOn(studioApi, 'fetchStudios').mockRejectedValue(
      new ApiClientError('An unexpected error occurred.', {
        code: 'INTERNAL_ERROR',
        status: 500,
        requestId: 'req-987',
      }),
    );
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/studio details could not be loaded/i);
    expect(alert).toHaveTextContent('req-987');
  });
});
