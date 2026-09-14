/**
 * Shows, the broadcast schedule, ON AIR and live streams.
 *
 * Run against real PostgreSQL: expansion leans on the unique
 * `(schedule_id, starts_at)` key and the room exclusion constraint, and the
 * public read paths are decided by relation filters a mock would only echo.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API_PREFIX,
  type OccurrenceStatusValue,
  type PublicLiveStream,
  type PublicOnAir,
  type PublicSchedule,
  type PublicShow,
} from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { runJob } from '../../src/jobs/run-job.js';
import { shiftZonedDay, zonedDay } from '../../src/lib/time.js';
import {
  EXPAND_SHOWS_JOB,
  expandShowOccurrences,
} from '../../src/services/show-occurrence.service.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

const HOUR = 60 * 60 * 1000;
const iso = (ms: number): string => new Date(ms).toISOString();

/** Monday 14 September 2026, 08:00 in Nairobi (UTC+3, no DST). */
const MONDAY_MORNING = new Date('2026-09-14T05:00:00Z');

async function makeRoom(timezone = 'Africa/Nairobi') {
  const slug = `studio-${timezone.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const studio = await testDb.studio.create({ data: { name: slug, slug, timezone } });
  return testDb.studioRoom.create({
    data: { studioId: studio.id, name: 'Live Room', slug: 'live-room', hourlyRateCents: 100_000 },
  });
}

function titleOf(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function makeShow(slug: string, options: { isActive?: boolean } = {}) {
  return testDb.show.create({
    data: { slug, name: titleOf(slug), category: 'Talk', isActive: options.isActive ?? true },
  });
}

function makeSchedule(
  showId: string,
  rule: {
    weekdays: number[];
    startMinute: number;
    endMinute: number;
    roomId?: string;
    validFrom?: Date;
    validTo?: Date;
    isActive?: boolean;
    createdAt?: Date;
  },
) {
  return testDb.showSchedule.create({
    data: {
      showId,
      weekdays: rule.weekdays,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      roomId: rule.roomId ?? null,
      validFrom: rule.validFrom ?? new Date('2026-01-01T00:00:00Z'),
      validTo: rule.validTo ?? null,
      isActive: rule.isActive ?? true,
      ...(rule.createdAt ? { createdAt: rule.createdAt } : {}),
    },
  });
}

function makeAiring(
  showId: string,
  startsAt: string,
  endsAt: string,
  extra: { status?: OccurrenceStatusValue; title?: string; wentLiveAt?: Date } = {},
) {
  return testDb.showOccurrence.create({
    data: {
      showId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      status: extra.status ?? 'SCHEDULED',
      title: extra.title ?? null,
      wentLiveAt: extra.wentLiveAt ?? null,
    },
  });
}

describe('show occurrence expansion', () => {
  it('materialises weekday slots as wall-clock times in the studio timezone', async () => {
    const room = await makeRoom();
    const show = await makeShow('morning-drive');
    await makeSchedule(show.id, {
      roomId: room.id,
      weekdays: [1, 2, 3, 4, 5],
      startMinute: 6 * 60,
      endMinute: 10 * 60,
    });

    const result = await expandShowOccurrences({ now: MONDAY_MORNING, horizonDays: 7 });

    expect(result).toEqual({ created: 5, existing: 0, conflicts: [] });
    const rows = await testDb.showOccurrence.findMany({ orderBy: { startsAt: 'asc' } });
    expect(rows.map((row) => [row.startsAt.toISOString(), row.endsAt.toISOString()])).toEqual([
      ['2026-09-14T03:00:00.000Z', '2026-09-14T07:00:00.000Z'],
      ['2026-09-15T03:00:00.000Z', '2026-09-15T07:00:00.000Z'],
      ['2026-09-16T03:00:00.000Z', '2026-09-16T07:00:00.000Z'],
      ['2026-09-17T03:00:00.000Z', '2026-09-17T07:00:00.000Z'],
      ['2026-09-18T03:00:00.000Z', '2026-09-18T07:00:00.000Z'],
    ]);
    expect(
      rows.every(
        (row) => row.status === 'SCHEDULED' && row.roomId === room.id && row.showId === show.id,
      ),
    ).toBe(true);
  });

  it('is idempotent and does not backfill airings that have already ended', async () => {
    const room = await makeRoom();
    const show = await makeShow('morning-drive');
    await makeSchedule(show.id, {
      roomId: room.id,
      weekdays: [1, 2, 3, 4, 5],
      startMinute: 6 * 60,
      endMinute: 10 * 60,
    });

    // 11:00 in Nairobi: Monday's 06:00–10:00 slot is already over.
    const lateMorning = new Date('2026-09-14T08:00:00Z');

    expect(await expandShowOccurrences({ now: lateMorning, horizonDays: 7 })).toEqual({
      created: 4,
      existing: 0,
      conflicts: [],
    });
    expect(await expandShowOccurrences({ now: lateMorning, horizonDays: 7 })).toEqual({
      created: 0,
      existing: 4,
      conflicts: [],
    });
    expect(await testDb.showOccurrence.count()).toBe(4);
  });

  it('honours the validity window and skips paused rules and retired shows', async () => {
    const room = await makeRoom();
    const bounded = await makeShow('bounded');
    await makeSchedule(bounded.id, {
      roomId: room.id,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startMinute: 12 * 60,
      endMinute: 13 * 60,
      validFrom: new Date('2026-09-15T00:00:00Z'),
      // Exclusive: the airing starting exactly at this instant is outside.
      validTo: new Date('2026-09-17T09:00:00Z'),
    });

    const paused = await makeShow('paused');
    await makeSchedule(paused.id, {
      roomId: room.id,
      weekdays: [1],
      startMinute: 14 * 60,
      endMinute: 15 * 60,
      isActive: false,
    });

    const retired = await makeShow('retired', { isActive: false });
    await makeSchedule(retired.id, {
      roomId: room.id,
      weekdays: [1],
      startMinute: 16 * 60,
      endMinute: 17 * 60,
    });

    const result = await expandShowOccurrences({ now: MONDAY_MORNING, horizonDays: 7 });

    expect(result.created).toBe(2);
    const rows = await testDb.showOccurrence.findMany({ orderBy: { startsAt: 'asc' } });
    expect(rows.map((row) => row.startsAt.toISOString())).toEqual([
      '2026-09-15T09:00:00.000Z',
      '2026-09-16T09:00:00.000Z',
    ]);
  });

  it("uses the timezone of the room's studio", async () => {
    const room = await makeRoom('UTC');
    const show = await makeShow('utc-show');
    await makeSchedule(show.id, {
      roomId: room.id,
      weekdays: [1],
      startMinute: 18 * 60,
      endMinute: 19 * 60,
    });

    await expandShowOccurrences({ now: MONDAY_MORNING, horizonDays: 1 });

    const row = await testDb.showOccurrence.findFirstOrThrow();
    expect(row.startsAt.toISOString()).toBe('2026-09-14T18:00:00.000Z');
  });

  it('reports a room clash and leaves the room with the established slot', async () => {
    const room = await makeRoom();
    const established = await makeShow('established');
    const newcomer = await makeShow('newcomer');
    await makeSchedule(established.id, {
      roomId: room.id,
      weekdays: [1],
      startMinute: 9 * 60,
      endMinute: 11 * 60,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const clashing = await makeSchedule(newcomer.id, {
      roomId: room.id,
      weekdays: [1],
      startMinute: 10 * 60,
      endMinute: 12 * 60,
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });

    const result = await expandShowOccurrences({ now: MONDAY_MORNING, horizonDays: 1 });

    expect(result.created).toBe(1);
    expect(result.conflicts).toEqual([
      { scheduleId: clashing.id, startsAt: '2026-09-14T07:00:00.000Z' },
    ]);
    const rows = await testDb.showOccurrence.findMany();
    expect(rows.map((row) => row.showId)).toEqual([established.id]);
  });

  it('records each run in the jobs table', async () => {
    await runJob(EXPAND_SHOWS_JOB, () =>
      expandShowOccurrences({ now: MONDAY_MORNING, horizonDays: 1 }),
    );
    expect(await testDb.job.findUniqueOrThrow({ where: { name: EXPAND_SHOWS_JOB } })).toMatchObject(
      { status: 'SUCCESS', runCount: 1, lastError: null },
    );

    await expect(
      runJob(EXPAND_SHOWS_JOB, () => Promise.reject(new Error('database went away'))),
    ).rejects.toThrow('database went away');
    expect(await testDb.job.findUniqueOrThrow({ where: { name: EXPAND_SHOWS_JOB } })).toMatchObject(
      { status: 'FAILED', runCount: 2, lastError: 'database went away' },
    );
  });
});

describe('GET /api/v1/shows', () => {
  it('lists active shows with only the slots in effect today', async () => {
    const drive = await makeShow('morning-drive');
    await makeSchedule(drive.id, { weekdays: [5, 1, 3], startMinute: 360, endMinute: 600 });
    await makeSchedule(drive.id, {
      weekdays: [6],
      startMinute: 480,
      endMinute: 540,
      isActive: false,
    });
    await makeSchedule(drive.id, {
      weekdays: [0],
      startMinute: 480,
      endMinute: 540,
      validTo: new Date('2026-01-31T00:00:00Z'),
    });

    const upcoming = await makeShow('coming-soon');
    await makeSchedule(upcoming.id, {
      weekdays: [2],
      startMinute: 600,
      endMinute: 660,
      validFrom: new Date(Date.now() + 30 * 24 * HOUR),
    });

    await makeShow('retired-show', { isActive: false });

    const res = await request(app).get(`${API_PREFIX}/shows`);

    expect(res.status).toBe(200);
    expect(res.body.data as PublicShow[]).toEqual([
      { slug: 'coming-soon', name: 'Coming Soon', description: null, category: 'Talk', slots: [] },
      {
        slug: 'morning-drive',
        name: 'Morning Drive',
        description: null,
        category: 'Talk',
        slots: [{ weekdays: [1, 3, 5], startMinute: 360, endMinute: 600 }],
      },
    ]);
  });
});

describe('GET /api/v1/shows/schedule', () => {
  it('returns airings overlapping the window, without cancellations or retired shows', async () => {
    const drive = await makeShow('morning-drive');
    const retired = await makeShow('retired-show', { isActive: false });

    // Starts before the window opens but runs into it.
    const edge = await makeAiring(drive.id, '2026-09-13T20:00:00Z', '2026-09-13T22:00:00Z', {
      title: 'Late special',
    });
    await makeAiring(drive.id, '2026-09-14T03:00:00Z', '2026-09-14T07:00:00Z', {
      status: 'ENDED',
    });
    await makeAiring(drive.id, '2026-09-15T03:00:00Z', '2026-09-15T07:00:00Z', {
      status: 'CANCELLED',
    });
    await makeAiring(retired.id, '2026-09-15T08:00:00Z', '2026-09-15T09:00:00Z');
    // Starts exactly as the half-open window closes.
    await makeAiring(drive.id, '2026-09-20T21:00:00Z', '2026-09-20T23:00:00Z');

    const res = await request(app)
      .get(`${API_PREFIX}/shows/schedule`)
      .query({ from: '2026-09-13T21:00:00Z', to: '2026-09-20T21:00:00Z' });

    expect(res.status).toBe(200);
    const schedule = res.body.data as PublicSchedule;
    expect(schedule).toMatchObject({
      timezone: env.TIMEZONE,
      from: '2026-09-13T21:00:00.000Z',
      to: '2026-09-20T21:00:00.000Z',
    });
    expect(schedule.airings).toEqual([
      {
        id: edge.id,
        showSlug: 'morning-drive',
        showName: 'Morning Drive',
        title: 'Late special',
        category: 'Talk',
        startsAt: '2026-09-13T20:00:00.000Z',
        endsAt: '2026-09-13T22:00:00.000Z',
        status: 'SCHEDULED',
      },
      expect.objectContaining({
        startsAt: '2026-09-14T03:00:00.000Z',
        status: 'ENDED',
        title: null,
      }),
    ]);
  });

  it('defaults to seven whole days from the start of today in the studio timezone', async () => {
    const res = await request(app).get(`${API_PREFIX}/shows/schedule`);

    expect(res.status).toBe(200);
    const today = zonedDay(new Date(), env.TIMEZONE);
    expect(res.body.data).toEqual({
      timezone: env.TIMEZONE,
      from: today.start.toISOString(),
      to: shiftZonedDay(today, 7, env.TIMEZONE).start.toISOString(),
      airings: [],
    });
  });

  it.each([
    ['a malformed date', { from: 'yesterday' }, 'from'],
    ['an empty window', { from: '2026-09-14T00:00:00Z', to: '2026-09-14T00:00:00Z' }, 'to'],
    ['a window over 31 days', { from: '2026-09-01T00:00:00Z', to: '2026-10-03T00:00:00Z' }, 'to'],
  ])('rejects %s', async (_label, query, path) => {
    const res = await request(app).get(`${API_PREFIX}/shows/schedule`).query(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((res.body.error.details as Array<{ path: string }>).map((d) => d.path)).toContain(path);
  });
});

describe('GET /api/v1/on-air', () => {
  it('never infers ON AIR from the clock', async () => {
    const drive = await makeShow('morning-drive');
    const now = Date.now();

    // Its slot covers this very moment, but no operator has put it on air.
    await makeAiring(drive.id, iso(now - HOUR), iso(now + HOUR));
    await makeAiring(drive.id, iso(now + HOUR), iso(now + 2 * HOUR), { status: 'CANCELLED' });
    const upcoming = await makeAiring(drive.id, iso(now + 2 * HOUR), iso(now + 3 * HOUR));
    await makeAiring(drive.id, iso(now + 5 * HOUR), iso(now + 6 * HOUR));

    const res = await request(app).get(`${API_PREFIX}/on-air`);

    expect(res.status).toBe(200);
    const body = res.body.data as PublicOnAir;
    expect(body.timezone).toBe(env.TIMEZONE);
    expect(body.current).toBeNull();
    expect(body.next?.id).toBe(upcoming.id);
  });

  it('reports the airing an operator has put on air', async () => {
    const drive = await makeShow('morning-drive');
    const now = Date.now();
    const wentLiveAt = new Date(now - 10 * 60_000);
    const live = await makeAiring(drive.id, iso(now - HOUR), iso(now + HOUR), {
      status: 'LIVE',
      wentLiveAt,
    });

    const res = await request(app).get(`${API_PREFIX}/on-air`);

    expect(res.status).toBe(200);
    expect((res.body.data as PublicOnAir).current).toEqual({
      id: live.id,
      showSlug: 'morning-drive',
      showName: 'Morning Drive',
      title: null,
      category: 'Talk',
      startsAt: iso(now - HOUR),
      endsAt: iso(now + HOUR),
      status: 'LIVE',
      wentLiveAt: wentLiveAt.toISOString(),
    });
    expect((res.body.data as PublicOnAir).next).toBeNull();
  });
});

describe('GET /api/v1/streams/live', () => {
  it('publishes only live, watchable platforms and never ingest details', async () => {
    const drive = await makeShow('morning-drive');
    const now = Date.now();
    const airing = await makeAiring(drive.id, iso(now - HOUR), iso(now + HOUR), {
      status: 'LIVE',
    });

    const live = await testDb.stream.create({
      data: {
        title: 'Morning Drive live',
        occurrenceId: airing.id,
        status: 'LIVE',
        startedAt: new Date('2026-09-14T03:00:00Z'),
        platforms: {
          create: [
            {
              platform: 'YOUTUBE',
              status: 'LIVE',
              externalId: 'yt-SECRET-ID',
              rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/KEY-SECRET',
              watchUrl: 'https://www.youtube.com/watch?v=abc123',
              embedUrl: 'https://www.youtube.com/embed/abc123',
            },
            {
              platform: 'FACEBOOK',
              status: 'LIVE',
              watchUrl: 'javascript:alert(1)',
              embedUrl: 'https://www.facebook.com.evil.example/plugins/video.php',
            },
            {
              platform: 'CUSTOM_RTMP',
              status: 'ERROR',
              watchUrl: 'https://stream.example/watch',
            },
          ],
        },
      },
    });

    // Live, but its only platform offers nothing a visitor can open.
    await testDb.stream.create({
      data: {
        title: 'Unwatchable',
        status: 'LIVE',
        platforms: {
          create: [
            {
              platform: 'CUSTOM_RTMP',
              status: 'LIVE',
              embedUrl: 'https://www.youtube.com/embed/x',
            },
          ],
        },
      },
    });

    await testDb.stream.create({
      data: {
        title: 'Yesterday',
        status: 'ENDED',
        platforms: {
          create: [
            {
              platform: 'YOUTUBE',
              status: 'ENDED',
              watchUrl: 'https://www.youtube.com/watch?v=old',
            },
          ],
        },
      },
    });

    const res = await request(app).get(`${API_PREFIX}/streams/live`);

    expect(res.status).toBe(200);
    expect(res.body.data as PublicLiveStream[]).toEqual([
      {
        id: live.id,
        title: 'Morning Drive live',
        description: null,
        showName: 'Morning Drive',
        startedAt: '2026-09-14T03:00:00.000Z',
        platforms: [
          {
            platform: 'YOUTUBE',
            watchUrl: 'https://www.youtube.com/watch?v=abc123',
            embedUrl: 'https://www.youtube.com/embed/abc123',
          },
        ],
      },
    ]);

    const body = JSON.stringify(res.body);
    for (const leak of ['SECRET', 'rtmp', 'externalId', 'javascript:', 'evil.example']) {
      expect(body).not.toContain(leak);
    }
  });
});
