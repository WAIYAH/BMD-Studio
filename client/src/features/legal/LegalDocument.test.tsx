import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicStudio } from '@bmd/shared';
import * as studioApi from '@/features/studio/api';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';

const STUDIO: PublicStudio = {
  slug: 'bmd-nairobi',
  name: 'B.M.D Studio',
  branch: 'Nairobi',
  description: null,
  addressLine: null,
  city: 'Nairobi',
  county: 'Nairobi',
  phone: null,
  email: null,
  location: null,
  timezone: 'Africa/Nairobi',
  hours: [],
  rooms: [],
};

function renderPrivacyPolicy() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/privacy']}>
        <PrivacyPolicyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LegalDocument', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('numbers every section and links to each from the table of contents', () => {
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([STUDIO]);
    renderPrivacyPolicy();

    const contents = screen.getByRole('navigation', { name: 'On this page' });
    const links = within(contents).getAllByRole('link');
    expect(links[0]).toHaveTextContent('1. Who we are');
    expect(links[0]).toHaveAttribute('href', '#who-we-are');

    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)).not.toBeNull();
    }

    expect(screen.getByRole('heading', { level: 2, name: '9. Your rights' })).toBeInTheDocument();
  });

  it('links between the legal documents and shows when they last changed', () => {
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([STUDIO]);
    renderPrivacyPolicy();

    const legal = screen.getByRole('navigation', { name: 'Legal documents' });
    expect(within(legal).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(legal).getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute(
      'href',
      '/cookies',
    );
    expect(within(legal).getByRole('link', { name: 'Booking & Hire Terms' })).toHaveAttribute(
      'href',
      '/booking-terms',
    );

    expect(screen.getByText('14 September 2026')).toHaveAttribute('dateTime', '2026-09-14');
    expect(document.title).toBe('Privacy Policy · B.M.D Studio');
  });
});

describe('LegalContact', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the email and phone the studio has published', async () => {
    vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([
      { ...STUDIO, email: 'hello@studio.test', phone: '+254700000000' },
    ]);
    renderPrivacyPolicy();

    expect(await screen.findByRole('link', { name: 'hello@studio.test' })).toHaveAttribute(
      'href',
      'mailto:hello@studio.test',
    );
    expect(screen.getByRole('link', { name: '+254700000000' })).toHaveAttribute(
      'href',
      'tel:+254700000000',
    );
  });

  it('directs people to the studio rather than inventing a contact address', async () => {
    const fetch = vi.spyOn(studioApi, 'fetchStudios').mockResolvedValue([STUDIO]);
    renderPrivacyPolicy();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText(/speak to us in person at the studio/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Visit us' })).toHaveAttribute('href', '/visit');
    expect(screen.queryByRole('link', { name: /@/ })).not.toBeInTheDocument();
  });
});
