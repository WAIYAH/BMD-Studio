/**
 * Public service and equipment catalogues.
 *
 * Run against real PostgreSQL because what is listed is decided by relation
 * filters — closed studios, rooms under maintenance, retired stock. A mocked
 * client would only echo the fixture back and prove none of those rules.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { API_PREFIX, type PublicEquipmentCategory, type PublicServiceCategory } from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

async function linkRooms(
  serviceId: string,
  links: Array<{ roomId: string; priceCentsOverride?: number }>,
): Promise<void> {
  await testDb.roomService.createMany({ data: links.map((link) => ({ serviceId, ...link })) });
}

async function makeServiceFixtures(): Promise<void> {
  const studio = await testDb.studio.create({ data: { name: 'Test Studio', slug: 'test-studio' } });
  const closedStudio = await testDb.studio.create({
    data: { name: 'Closed Studio', slug: 'closed-studio', isActive: false },
  });

  const room = (studioId: string, slug: string, name: string, status: 'ACTIVE' | 'MAINTENANCE') =>
    testDb.studioRoom.create({
      data: { studioId, slug, name, status, capacity: 4, hourlyRateCents: 100_000 },
    });

  // Created out of name order so the response ordering is actually exercised.
  const roomB = await room(studio.id, 'room-b', 'Room B', 'ACTIVE');
  const roomA = await room(studio.id, 'room-a', 'Room A', 'ACTIVE');
  const roomDown = await room(studio.id, 'room-down', 'Room Down', 'MAINTENANCE');
  const roomElsewhere = await room(closedStudio.id, 'room-x', 'Room X', 'ACTIVE');

  const podcast = await testDb.serviceCategory.create({
    data: { slug: 'podcast', name: 'Podcast', position: 2 },
  });
  const broadcast = await testDb.serviceCategory.create({
    data: { slug: 'broadcast', name: 'Broadcast', position: 1 },
  });
  const photography = await testDb.serviceCategory.create({
    data: { slug: 'photography', name: 'Photography', position: 3 },
  });
  const dormant = await testDb.serviceCategory.create({
    data: { slug: 'dormant', name: 'Dormant', position: 4 },
  });

  const recording = await testDb.service.create({
    data: {
      categoryId: podcast.id,
      slug: 'podcast-recording',
      name: 'Podcast Recording',
      pricingModel: 'HOURLY',
      basePriceCents: 250_000,
      minDurationMin: 60,
      maxDurationMin: 300,
    },
  });
  await linkRooms(recording.id, [
    { roomId: roomB.id },
    { roomId: roomA.id, priceCentsOverride: 200_000 },
    { roomId: roomDown.id },
  ]);

  const inactive = await testDb.service.create({
    data: {
      categoryId: podcast.id,
      slug: 'voice-over',
      name: 'Voice-Over',
      pricingModel: 'HOURLY',
      basePriceCents: 180_000,
      isActive: false,
    },
  });
  await linkRooms(inactive.id, [{ roomId: roomA.id }]);

  const radio = await testDb.service.create({
    data: {
      categoryId: broadcast.id,
      slug: 'live-radio',
      name: 'Live Radio',
      pricingModel: 'SESSION',
      basePriceCents: 900_000,
      requiresApproval: true,
    },
  });
  await linkRooms(radio.id, [{ roomId: roomA.id }]);

  const stranded = await testDb.service.create({
    data: {
      categoryId: broadcast.id,
      slug: 'stranded',
      name: 'Stranded',
      pricingModel: 'HOURLY',
      basePriceCents: 100_000,
    },
  });
  await linkRooms(stranded.id, [{ roomId: roomDown.id }, { roomId: roomElsewhere.id }]);

  const portrait = await testDb.service.create({
    data: {
      categoryId: photography.id,
      slug: 'studio-portrait',
      name: 'Studio Portrait',
      pricingModel: 'PACKAGE',
      basePriceCents: 1_500_000,
    },
  });
  await linkRooms(portrait.id, [{ roomId: roomA.id }]);
  await testDb.photographyPackage.createMany({
    data: [
      {
        serviceId: portrait.id,
        name: 'Extended',
        deliverableCount: 25,
        editTurnaroundDays: 7,
        priceCents: 2_200_000,
      },
      {
        serviceId: portrait.id,
        name: 'Essential',
        deliverableCount: 10,
        editTurnaroundDays: 5,
        priceCents: 1_200_000,
      },
      {
        serviceId: portrait.id,
        name: 'Withdrawn',
        deliverableCount: 5,
        editTurnaroundDays: 3,
        priceCents: 500_000,
        isActive: false,
      },
    ],
  });

  const retired = await testDb.service.create({
    data: {
      categoryId: dormant.id,
      slug: 'retired-service',
      name: 'Retired Service',
      pricingModel: 'HOURLY',
      basePriceCents: 100_000,
      isActive: false,
    },
  });
  await linkRooms(retired.id, [{ roomId: roomA.id }]);
}

describe('GET /api/v1/services/catalogue', () => {
  it('is public and returns an empty list when nothing is configured', async () => {
    const res = await request(app).get(`${API_PREFIX}/services/catalogue`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('lists only services that are active and deliverable in an open room', async () => {
    await makeServiceFixtures();

    const res = await request(app).get(`${API_PREFIX}/services/catalogue`);
    expect(res.status).toBe(200);

    const categories = res.body.data as PublicServiceCategory[];
    // Ordered by position; the dormant category has nothing bookable and is hidden.
    expect(categories.map((category) => category.slug)).toEqual([
      'broadcast',
      'podcast',
      'photography',
    ]);

    const slugs = categories.flatMap((category) => category.services.map((s) => s.slug));
    expect(slugs).toEqual(['live-radio', 'podcast-recording', 'studio-portrait']);
  });

  it('prices each room by its override or the base price, excluding closed rooms', async () => {
    await makeServiceFixtures();

    const res = await request(app).get(`${API_PREFIX}/services/catalogue`);
    const categories = res.body.data as PublicServiceCategory[];
    const recording = categories
      .find((category) => category.slug === 'podcast')
      ?.services.find((service) => service.slug === 'podcast-recording');

    expect(recording).toMatchObject({
      name: 'Podcast Recording',
      pricingModel: 'HOURLY',
      basePriceCents: 250_000,
      fromPriceCents: 200_000,
      minDurationMinutes: 60,
      maxDurationMinutes: 300,
      requiresApproval: false,
      packages: [],
    });
    expect(recording?.rooms).toEqual([
      { slug: 'room-a', name: 'Room A', capacity: 4, priceCents: 200_000 },
      { slug: 'room-b', name: 'Room B', capacity: 4, priceCents: 250_000 },
    ]);
  });

  it('includes only active photography packages, cheapest first', async () => {
    await makeServiceFixtures();

    const res = await request(app).get(`${API_PREFIX}/services/catalogue`);
    const categories = res.body.data as PublicServiceCategory[];
    const portrait = categories.find((c) => c.slug === 'photography')?.services[0];

    expect(portrait?.packages.map((pkg) => pkg.name)).toEqual(['Essential', 'Extended']);
    expect(portrait?.fromPriceCents).toBe(1_200_000);
  });
});

describe('GET /api/v1/equipment/catalogue', () => {
  async function makeEquipmentFixtures(): Promise<void> {
    const mics = await testDb.equipmentCategory.create({
      data: { slug: 'microphones', name: 'Microphones' },
    });
    const cameras = await testDb.equipmentCategory.create({
      data: { slug: 'cameras', name: 'Cameras' },
    });
    const archive = await testDb.equipmentCategory.create({
      data: { slug: 'archive', name: 'Archive' },
    });

    const sm7b = {
      categoryId: mics.id,
      name: 'Shure SM7B',
      dailyRateCents: 150_000,
      depositCents: 1_000_000,
    };

    await testDb.equipment.createMany({
      data: [
        { ...sm7b, assetTag: 'TAG-SECRET-1', serialNo: 'SN-SECRET-1', location: 'Rack 9' },
        { ...sm7b, assetTag: 'TAG-SECRET-2', status: 'RENTED' },
        {
          ...sm7b,
          assetTag: 'TAG-SECRET-3',
          condition: 'DAMAGED',
          description: 'Broadcast dynamic mic',
        },
        { ...sm7b, assetTag: 'TAG-SECRET-4', status: 'RETIRED' },
        { ...sm7b, assetTag: 'TAG-SECRET-5', dailyRateCents: 180_000 },
        {
          categoryId: mics.id,
          name: 'Condenser',
          manufacturer: 'Rode',
          model: 'NT1-A',
          assetTag: 'TAG-SECRET-6',
          condition: 'POOR',
          dailyRateCents: 120_000,
        },
        {
          categoryId: cameras.id,
          name: 'Sony A7 III',
          assetTag: 'TAG-SECRET-7',
          status: 'MAINTENANCE',
          dailyRateCents: 600_000,
          depositCents: 5_000_000,
        },
        {
          categoryId: archive.id,
          name: 'Old Deck',
          assetTag: 'TAG-SECRET-8',
          status: 'RETIRED',
          dailyRateCents: 50_000,
        },
      ],
    });
  }

  it('is public and returns an empty list when nothing is configured', async () => {
    const res = await request(app).get(`${API_PREFIX}/equipment/catalogue`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('groups units into products and counts only units fit to go out now', async () => {
    await makeEquipmentFixtures();

    const res = await request(app).get(`${API_PREFIX}/equipment/catalogue`);
    expect(res.status).toBe(200);

    const categories = res.body.data as PublicEquipmentCategory[];
    // Archive holds only retired stock and is hidden.
    expect(categories.map((category) => category.name)).toEqual(['Cameras', 'Microphones']);

    const mics = categories.find((category) => category.slug === 'microphones')?.items ?? [];
    expect(
      mics.map(({ name, dailyRateCents, unitCount, availableCount }) => ({
        name,
        dailyRateCents,
        unitCount,
        availableCount,
      })),
    ).toEqual([
      // POOR condition is still fit to hire; only DAMAGED is withheld.
      { name: 'Condenser', dailyRateCents: 120_000, unitCount: 1, availableCount: 1 },
      // Retired unit excluded; rented and damaged units counted but not available.
      { name: 'Shure SM7B', dailyRateCents: 150_000, unitCount: 3, availableCount: 1 },
      // Same product at different terms is a separate listing.
      { name: 'Shure SM7B', dailyRateCents: 180_000, unitCount: 1, availableCount: 1 },
    ]);

    expect(mics[0]).toMatchObject({ manufacturer: 'Rode', model: 'NT1-A', depositCents: 0 });
    expect(mics[1]?.description).toBe('Broadcast dynamic mic');
    expect(new Set(mics.map((item) => item.key)).size).toBe(mics.length);

    const camera = categories.find((category) => category.slug === 'cameras')?.items[0];
    expect(camera).toMatchObject({ unitCount: 1, availableCount: 0 });
  });

  it('never exposes asset tags, serial numbers or store locations', async () => {
    await makeEquipmentFixtures();

    const res = await request(app).get(`${API_PREFIX}/equipment/catalogue`);
    const body = JSON.stringify(res.body);

    for (const leak of ['TAG-SECRET', 'SN-SECRET', 'Rack 9', 'assetTag', 'serialNo', 'location']) {
      expect(body).not.toContain(leak);
    }
  });
});
