import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicSchedule, PublicShow } from '@bmd/shared';
import * as broadcastApi from '@/features/broadcast/api';
import { ApiClientError } from '@/lib/api-client';
import { ShowsPage } from './ShowsPage';

const SCHEDULE: PublicSchedule = {
  timezone: 'Africa/Nairobi',
  from: '2026-09-13T21:00:00.000Z',
  to: '2026-09-20T21:00:00.000Z',
  airings: [
    {
      id: 'a1',
      showSlug: 'morning-drive',
      showName: 'Morning Drive',
      title: null,
      category: 'Talk',
      startsAt: '2026-09-14T03:00:00.000Z',
      endsAt: '2026-09-14T07:00:00.000Z',
      status: 'LIVE',
    },
    {
      id: 'a2',
      showSlug: 'the-midday-mix',
      showName: 'The Midday Mix',
      title: 'Request hour',
      category: 'Music',
      startsAt: '2026-09-14T09:00:00.000Z',
      endsAt: '2026-09-14T12:00:00.000Z',
      status: 'SCHEDULED',
    },
    {
      // 00:30 on Tuesday in Nairobi, though still Monday in UTC.
      id: 'a3',
      showSlug: 'late-night',
      showName: 'Late Night',
      title: null,
      category: null,
      startsAt: '2026-09-14T21:30:00.000Z',
      endsAt: '2026-09-14T23:00:00.000Z',
      status: 'SCHEDULED',
    },
  ],
};

const LINEUP: PublicShow[] = [
  {
    slug: 'late-night',
    name: 'Late Night',
    description: null,
    category: null,
    slots: [],
  },
  {
    slug: 'morning-drive',
    name: 'Morning Drive',
    description: 'News and traffic to start the day.',
    category: 'Talk',
    slots: [{ weekdays: [1, 2, 3, 4, 5], startMinute: 360, endMinute: 600 }],
  },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ShowsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ShowsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('groups airings by studio day and shows studio times', async () => {
    vi.spyOn(broadcastApi, 'fetchSchedule').mockResolvedValue(SCHEDULE);
    vi.spyOn(broadcastApi, 'fetchShowLineup').mockResolvedValue(LINEUP);
    renderPage();

    const monday = await screen.findByRole('region', { name: 'Monday 14 September' });
    expect(within(monday).getByText('06:00 – 10:00')).toBeInTheDocument();
    expect(within(monday).getByText('Request hour')).toBeInTheDocument();
    expect(within(monday).queryByText('Late Night')).not.toBeInTheDocument();

    const tuesday = screen.getByRole('region', { name: 'Tuesday 15 September' });
    expect(within(tuesday).getByText('00:30 – 02:00')).toBeInTheDocument();
    expect(within(tuesday).getByText('Late Night')).toBeInTheDocument();
  });

  it('marks only the airing an operator has put on air', async () => {
    vi.spyOn(broadcastApi, 'fetchSchedule').mockResolvedValue(SCHEDULE);
    vi.spyOn(broadcastApi, 'fetchShowLineup').mockResolvedValue(LINEUP);
    renderPage();

    const monday = await screen.findByRole('region', { name: 'Monday 14 September' });
    expect(within(monday).getAllByText('On air')).toHaveLength(1);
    expect(screen.getAllByText('On air')).toHaveLength(1);
  });

  it("lists the line-up with each show's weekly slot", async () => {
    vi.spyOn(broadcastApi, 'fetchSchedule').mockResolvedValue(SCHEDULE);
    vi.spyOn(broadcastApi, 'fetchShowLineup').mockResolvedValue(LINEUP);
    renderPage();

    const drive = await screen.findByRole('article', { name: 'Morning Drive' });
    expect(within(drive).getByText('Mon – Fri · 06:00 – 10:00')).toBeInTheDocument();
    expect(within(drive).getByText('News and traffic to start the day.')).toBeInTheDocument();

    const lateNight = screen.getByRole('article', { name: 'Late Night' });
    expect(within(lateNight).getByText('No regular slot at the moment')).toBeInTheDocument();
  });

  it('reports a schedule failure with its reference while still showing the line-up', async () => {
    vi.spyOn(broadcastApi, 'fetchSchedule').mockRejectedValue(
      new ApiClientError('An unexpected error occurred.', {
        code: 'INTERNAL_ERROR',
        status: 500,
        requestId: 'req-456',
      }),
    );
    vi.spyOn(broadcastApi, 'fetchShowLineup').mockResolvedValue(LINEUP);
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/the schedule could not be loaded/i);
    expect(alert).toHaveTextContent('req-456');
    expect(await screen.findByRole('article', { name: 'Morning Drive' })).toBeInTheDocument();
  });

  it('says so when nothing is scheduled', async () => {
    vi.spyOn(broadcastApi, 'fetchSchedule').mockResolvedValue({ ...SCHEDULE, airings: [] });
    vi.spyOn(broadcastApi, 'fetchShowLineup').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Nothing is scheduled this week')).toBeInTheDocument();
    expect(await screen.findByText('No shows on the line-up')).toBeInTheDocument();
  });
});
