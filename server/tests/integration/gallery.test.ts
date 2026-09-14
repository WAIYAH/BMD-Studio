/**
 * Public galleries.
 *
 * What may be shown is decided by two flags that live on different rows — the
 * gallery's `is_published` and each file's `visibility` — so these run against
 * real PostgreSQL rather than a mock that would only echo fixtures back.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { API_PREFIX, type PublicGallery, type PublicGallerySummary } from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();

/** Set for the suite in vitest.config.ts. */
const BASE = 'https://media.test.invalid';

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

let sequence = 0;

function makeMedia(
  overrides: {
    visibility?: 'PUBLIC' | 'PRIVATE';
    storageKey?: string;
    mimeType?: string;
    variants?: Prisma.InputJsonValue;
    altText?: string;
  } = {},
) {
  sequence += 1;
  return testDb.mediaFile.create({
    data: {
      storageKey: overrides.storageKey ?? `galleries/photo-${sequence}.jpg`,
      bucket: 'bucket-SECRET',
      filename: `photo-${sequence}.jpg`,
      mimeType: overrides.mimeType ?? 'image/jpeg',
      sizeBytes: 2048,
      width: 1600,
      height: 1067,
      checksum: 'sha256-SECRET',
      visibility: overrides.visibility ?? 'PUBLIC',
      altText: overrides.altText ?? null,
      ...(overrides.variants !== undefined ? { variants: overrides.variants } : {}),
    },
  });
}

describe('GET /api/v1/media/galleries', () => {
  it('lists published galleries, counting and showing public files only', async () => {
    const privateCover = await makeMedia({ visibility: 'PRIVATE' });
    const first = await makeMedia({
      storageKey: 'galleries/weddings 2026/first shot.jpg',
      variants: { thumb: { key: 'galleries/weddings 2026/first shot@thumb.jpg' } },
      altText: 'Couple on the stage',
    });
    const second = await makeMedia();
    const hidden = await makeMedia({ visibility: 'PRIVATE' });

    const portfolio = await testDb.gallery.create({
      data: {
        slug: 'portfolio',
        title: 'Portfolio',
        type: 'PORTFOLIO',
        isPublished: true,
        publishedAt: new Date('2026-09-01T00:00:00Z'),
        coverMediaId: privateCover.id,
      },
    });
    await testDb.galleryItem.createMany({
      data: [
        { galleryId: portfolio.id, mediaId: second.id, position: 2 },
        { galleryId: portfolio.id, mediaId: first.id, position: 1 },
        { galleryId: portfolio.id, mediaId: hidden.id, position: 0 },
      ],
    });

    const older = await testDb.gallery.create({
      data: {
        slug: 'older',
        title: 'Older',
        isPublished: true,
        publishedAt: new Date('2026-08-01T00:00:00Z'),
        coverMediaId: second.id,
      },
    });
    await testDb.galleryItem.create({ data: { galleryId: older.id, mediaId: second.id } });

    const draft = await testDb.gallery.create({ data: { slug: 'draft', title: 'Draft' } });
    await testDb.galleryItem.create({ data: { galleryId: draft.id, mediaId: first.id } });

    const onlyPrivate = await testDb.gallery.create({
      data: {
        slug: 'only-private',
        title: 'Only Private',
        isPublished: true,
        publishedAt: new Date('2026-09-10T00:00:00Z'),
      },
    });
    await testDb.galleryItem.create({ data: { galleryId: onlyPrivate.id, mediaId: hidden.id } });

    const res = await request(app).get(`${API_PREFIX}/media/galleries`);

    expect(res.status).toBe(200);
    expect(res.body.data as PublicGallerySummary[]).toEqual([
      {
        slug: 'portfolio',
        title: 'Portfolio',
        description: null,
        type: 'PORTFOLIO',
        itemCount: 2,
        publishedAt: '2026-09-01T00:00:00.000Z',
        // The chosen cover is private, so the first public item stands in.
        cover: {
          url: `${BASE}/galleries/weddings%202026/first%20shot.jpg`,
          thumbnailUrl: `${BASE}/galleries/weddings%202026/first%20shot%40thumb.jpg`,
          mimeType: 'image/jpeg',
          width: 1600,
          height: 1067,
          altText: 'Couple on the stage',
        },
      },
      {
        slug: 'older',
        title: 'Older',
        description: null,
        type: 'PHOTO',
        itemCount: 1,
        publishedAt: '2026-08-01T00:00:00.000Z',
        cover: expect.objectContaining({ url: `${BASE}/${second.storageKey}` }),
      },
    ]);

    const body = JSON.stringify(res.body);
    for (const leak of [
      'SECRET',
      hidden.storageKey,
      privateCover.storageKey,
      'Draft',
      'Only Private',
    ]) {
      expect(body).not.toContain(leak);
    }
  });

  it('refuses rather than publish unloadable entries when no media origin is configured', async () => {
    const mutableEnv = env as unknown as { MEDIA_PUBLIC_BASE_URL: string | undefined };
    const original = mutableEnv.MEDIA_PUBLIC_BASE_URL;
    mutableEnv.MEDIA_PUBLIC_BASE_URL = undefined;

    try {
      const res = await request(app).get(`${API_PREFIX}/media/galleries`);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('INTEGRATION_NOT_CONFIGURED');
    } finally {
      mutableEnv.MEDIA_PUBLIC_BASE_URL = original;
    }
  });
});

describe('GET /api/v1/media/galleries/:slug', () => {
  it('returns public items in position order', async () => {
    const reel = await makeMedia({ storageKey: 'galleries/reel.mp4', mimeType: 'video/mp4' });
    // A malformed rendition record yields no thumbnail rather than a broken URL.
    const photo = await makeMedia({ variants: { thumb: { key: 42 } } });
    const hidden = await makeMedia({ visibility: 'PRIVATE' });

    const gallery = await testDb.gallery.create({
      data: {
        slug: 'studio-reel',
        title: 'Studio Reel',
        description: 'Behind the scenes',
        type: 'VIDEO',
        isPublished: true,
        publishedAt: new Date('2026-09-02T00:00:00Z'),
      },
    });
    const photoItem = await testDb.galleryItem.create({
      data: { galleryId: gallery.id, mediaId: photo.id, position: 1, caption: 'The desk' },
    });
    const reelItem = await testDb.galleryItem.create({
      data: { galleryId: gallery.id, mediaId: reel.id, position: 0 },
    });
    await testDb.galleryItem.create({
      data: { galleryId: gallery.id, mediaId: hidden.id, position: 2 },
    });

    const res = await request(app).get(`${API_PREFIX}/media/galleries/studio-reel`);

    expect(res.status).toBe(200);
    expect(res.body.data as PublicGallery).toEqual({
      slug: 'studio-reel',
      title: 'Studio Reel',
      description: 'Behind the scenes',
      type: 'VIDEO',
      publishedAt: '2026-09-02T00:00:00.000Z',
      items: [
        {
          id: reelItem.id,
          caption: null,
          media: {
            url: `${BASE}/galleries/reel.mp4`,
            thumbnailUrl: null,
            mimeType: 'video/mp4',
            width: 1600,
            height: 1067,
            altText: null,
          },
        },
        {
          id: photoItem.id,
          caption: 'The desk',
          media: expect.objectContaining({
            url: `${BASE}/${photo.storageKey}`,
            thumbnailUrl: null,
          }),
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain(hidden.storageKey);
  });

  it('treats an unpublished gallery exactly like a missing one', async () => {
    await testDb.gallery.create({ data: { slug: 'draft', title: 'Draft' } });

    for (const slug of ['draft', 'no-such-gallery']) {
      const res = await request(app).get(`${API_PREFIX}/media/galleries/${slug}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });
});
