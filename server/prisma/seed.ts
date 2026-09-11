/**
 * Database seed.
 *
 * Idempotent by construction: every write is an upsert keyed on a natural
 * unique column, so running it repeatedly converges on the same state instead
 * of accumulating duplicates. That matters because `prisma migrate reset` runs
 * it automatically and developers re-run it by hand.
 *
 * What it does NOT do is invent operational data. It seeds the access-control
 * vocabulary, one studio with real rooms and services, a starter equipment
 * catalogue and the show line-up — the things the application cannot start
 * without. It seeds no bookings, no payments and no stream statistics.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import argon2 from 'argon2';
import {
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from '@bmd/shared';

const prisma = new PrismaClient();

/** Argon2id parameters. Deliberately the same settings the auth service uses. */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP minimum for argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

const KES = (shillings: number): number => shillings * 100;

/** Human descriptions for the permission vocabulary, shown in the admin UI. */
const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'user:read': 'View user accounts',
  'user:write': 'Create and edit user accounts',
  'user:status:write': 'Activate, suspend or disable an account',
  'user:role:assign': 'Assign roles to a user',
  'role:read': 'View roles and their permissions',
  'role:write': 'Create, edit and delete roles',
  'studio:read': 'View studios and rooms',
  'studio:write': 'Create and edit studios, rooms, hours and blackouts',
  'service:read': 'View the service catalogue',
  'service:write': 'Create and edit services and categories',
  'booking:read:own': 'View own bookings',
  'booking:read:any': 'View any booking',
  'booking:create': 'Create a booking',
  'booking:update:own': 'Reschedule or amend own bookings',
  'booking:update:any': 'Reschedule or amend any booking',
  'booking:cancel:own': 'Cancel own bookings',
  'booking:cancel:any': 'Cancel any booking',
  'booking:approve': 'Approve bookings that require approval',
  'equipment:read': 'View the equipment catalogue',
  'equipment:write': 'Create and edit equipment records',
  'equipment:maintenance:write': 'Open and close maintenance tickets',
  'rental:read:own': 'View own equipment rentals',
  'rental:read:any': 'View any equipment rental',
  'rental:create': 'Request an equipment rental',
  'rental:approve': 'Approve or reject a rental request',
  'rental:checkout': 'Check equipment out to a customer',
  'rental:return': 'Accept an equipment return',
  'show:read': 'View shows and the broadcast schedule',
  'show:write': 'Create and edit shows and schedules',
  'show:host:assign': 'Assign presenters and hosts to a show',
  'onair:control': 'Put the studio on air and take it off air',
  'stream:read': 'View streams',
  'stream:write': 'Create and edit streams and platforms',
  'stream:control': 'Start and stop a live stream',
  'media:read': 'View media files and galleries',
  'media:upload': 'Upload media files',
  'media:delete': 'Delete media files',
  'gallery:write': 'Create and edit galleries',
  'payment:read:own': 'View own payments and receipts',
  'payment:read:any': 'View any payment',
  'payment:refund': 'Issue a refund',
  'notification:broadcast': 'Send a broadcast notification',
  'dashboard:view': 'View the operations dashboard',
  'report:view': 'View reports and analytics',
  'audit:read': 'Read the audit log',
  'settings:write': 'Change system settings',
};

async function seedPermissions(): Promise<Map<string, string>> {
  const keys = Object.values(PERMISSIONS) as Permission[];

  await prisma.$transaction(
    keys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {
          description: PERMISSION_DESCRIPTIONS[key] ?? key,
          resource: key.split(':')[0] ?? 'other',
        },
        create: {
          key,
          description: PERMISSION_DESCRIPTIONS[key] ?? key,
          resource: key.split(':')[0] ?? 'other',
        },
      }),
    ),
  );

  const rows = await prisma.permission.findMany({ select: { id: true, key: true } });
  console.log(`  permissions: ${rows.length}`);
  return new Map(rows.map((row) => [row.key, row.id]));
}

async function seedRoles(permissionIds: Map<string, string>): Promise<Map<string, string>> {
  const roleKeys = Object.values(ROLES) as Role[];

  for (const key of roleKeys) {
    const role = await prisma.role.upsert({
      where: { key },
      update: { name: ROLE_LABELS[key] },
      create: { key, name: ROLE_LABELS[key], isSystem: true },
    });

    const granted = ROLE_PERMISSIONS[key];
    const grantedIds = granted
      .map((permission) => permissionIds.get(permission))
      .filter((id): id is string => Boolean(id));

    // Replace the grant set rather than merging, so a permission removed from
    // ROLE_PERMISSIONS is actually revoked on the next seed run.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: grantedIds } },
      }),
      ...grantedIds.map((permissionId) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId },
        }),
      ),
    ]);
  }

  const rows = await prisma.role.findMany({
    select: { id: true, key: true, _count: { select: { permissions: true } } },
  });
  for (const row of rows) {
    console.log(`  role ${row.key}: ${row._count.permissions} permissions`);
  }
  return new Map(rows.map((row) => [row.key, row.id]));
}

/**
 * The bootstrap administrator.
 *
 * The password comes from the environment. There is no hard-coded fallback in
 * any environment: a known default password on a deployed system is a back
 * door, and a silent default in development trains people to expect one.
 */
async function seedAdminUser(roleIds: Map<string, string>): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      '  admin user: SKIPPED — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.',
    );
    return;
  }

  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  }

  const passwordHash = await argon2.hash(password, ARGON_OPTIONS);
  const superAdminRoleId = roleIds.get(ROLES.SUPER_ADMIN);
  if (!superAdminRoleId) throw new Error('SUPER_ADMIN role was not seeded.');

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    // An existing admin's password is never silently reset by a seed run.
    update: { status: 'ACTIVE', emailVerifiedAt: new Date() },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'System',
      lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Administrator',
      phone: process.env.SEED_ADMIN_PHONE ?? null,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdminRoleId } },
    update: {},
    create: { userId: user.id, roleId: superAdminRoleId },
  });

  console.log(`  admin user: ${user.email} (SUPER_ADMIN)`);
}

async function seedStudio(): Promise<string> {
  const studio = await prisma.studio.upsert({
    where: { slug: 'bmd-nairobi' },
    update: {},
    create: {
      name: 'B.M.D Studio',
      slug: 'bmd-nairobi',
      branch: 'Nairobi',
      description:
        'Radio, podcast, live streaming and photography studio serving Nairobi and its surrounds.',
      city: 'Nairobi',
      county: 'Nairobi',
      timezone: 'Africa/Nairobi',
      isActive: true,
    },
  });

  // Monday–Saturday 08:00–20:00, Sunday closed. Minutes from midnight, local.
  const hours = [
    { weekday: 0, openMinute: 0, closeMinute: 0, isClosed: true },
    ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      openMinute: 8 * 60,
      closeMinute: 20 * 60,
      isClosed: false,
    })),
  ];

  for (const hour of hours) {
    await prisma.operatingHour.upsert({
      where: { studioId_weekday: { studioId: studio.id, weekday: hour.weekday } },
      update: hour,
      create: { ...hour, studioId: studio.id },
    });
  }

  console.log(`  studio: ${studio.name} (${hours.filter((h) => !h.isClosed).length} open days)`);
  return studio.id;
}

async function seedRooms(studioId: string): Promise<Map<string, string>> {
  const rooms = [
    {
      slug: 'live-room',
      name: 'Live Broadcast Room',
      description: 'On-air radio and live stream desk with four host positions.',
      capacity: 4,
      hourlyRateCents: KES(3500),
      bufferMinutes: 15,
    },
    {
      slug: 'podcast-a',
      name: 'Podcast Studio A',
      description: 'Acoustically treated room for two to four person podcasts.',
      capacity: 4,
      hourlyRateCents: KES(2500),
      bufferMinutes: 15,
    },
    {
      slug: 'podcast-b',
      name: 'Podcast Studio B',
      description: 'Compact two-person podcast and voice-over booth.',
      capacity: 2,
      hourlyRateCents: KES(1800),
      bufferMinutes: 10,
    },
    {
      slug: 'photo-stage',
      name: 'Photography Stage',
      description: 'Cyclorama wall with continuous and strobe lighting.',
      capacity: 10,
      hourlyRateCents: KES(4000),
      bufferMinutes: 30,
    },
  ];

  const ids = new Map<string, string>();
  for (const room of rooms) {
    const created = await prisma.studioRoom.upsert({
      where: { studioId_slug: { studioId, slug: room.slug } },
      update: room,
      create: { ...room, studioId, status: 'ACTIVE' },
    });
    ids.set(room.slug, created.id);
  }

  console.log(`  rooms: ${ids.size}`);
  return ids;
}

async function seedServices(roomIds: Map<string, string>): Promise<void> {
  const catalogue: Array<{
    category: { slug: string; name: string; position: number };
    services: Array<Omit<Prisma.ServiceCreateManyInput, 'categoryId'> & { rooms: string[] }>;
  }> = [
    {
      category: { slug: 'broadcast', name: 'Radio & Broadcast', position: 1 },
      services: [
        {
          slug: 'live-radio-slot',
          name: 'Live Radio Slot',
          description: 'Hosted live broadcast slot with an engineer on the desk.',
          pricingModel: 'HOURLY',
          basePriceCents: KES(3500),
          minDurationMin: 60,
          maxDurationMin: 240,
          slotIntervalMin: 30,
          bufferMinutes: 15,
          requiresApproval: true,
          rooms: ['live-room'],
        },
      ],
    },
    {
      category: { slug: 'podcast', name: 'Podcast Production', position: 2 },
      services: [
        {
          slug: 'podcast-recording',
          name: 'Podcast Recording',
          description: 'Multi-mic recording with a producer and same-day raw files.',
          pricingModel: 'HOURLY',
          basePriceCents: KES(2500),
          minDurationMin: 60,
          maxDurationMin: 300,
          slotIntervalMin: 30,
          bufferMinutes: 15,
          requiresApproval: false,
          rooms: ['podcast-a', 'podcast-b'],
        },
        {
          slug: 'voice-over',
          name: 'Voice-Over Session',
          description: 'Booth time for adverts, narration and dubbing.',
          pricingModel: 'HOURLY',
          basePriceCents: KES(1800),
          minDurationMin: 30,
          maxDurationMin: 180,
          slotIntervalMin: 30,
          bufferMinutes: 10,
          requiresApproval: false,
          rooms: ['podcast-b'],
        },
      ],
    },
    {
      category: { slug: 'streaming', name: 'Live Streaming', position: 3 },
      services: [
        {
          slug: 'live-stream-production',
          name: 'Live Stream Production',
          description: 'Multi-camera stream to YouTube and Facebook with an operator.',
          pricingModel: 'SESSION',
          basePriceCents: KES(15000),
          minDurationMin: 120,
          maxDurationMin: 480,
          slotIntervalMin: 60,
          bufferMinutes: 30,
          requiresApproval: true,
          rooms: ['live-room', 'photo-stage'],
        },
      ],
    },
    {
      category: { slug: 'photography', name: 'Photography & Video', position: 4 },
      services: [
        {
          slug: 'studio-portrait',
          name: 'Studio Portrait Session',
          description: 'Lit portrait session on the cyclorama, edited selects delivered.',
          pricingModel: 'PACKAGE',
          basePriceCents: KES(12000),
          minDurationMin: 60,
          maxDurationMin: 240,
          slotIntervalMin: 60,
          bufferMinutes: 30,
          requiresApproval: false,
          rooms: ['photo-stage'],
        },
        {
          slug: 'product-shoot',
          name: 'Product Photography',
          description: 'Table-top product photography with retouched deliverables.',
          pricingModel: 'PACKAGE',
          basePriceCents: KES(18000),
          minDurationMin: 120,
          maxDurationMin: 480,
          slotIntervalMin: 60,
          bufferMinutes: 30,
          requiresApproval: false,
          rooms: ['photo-stage'],
        },
      ],
    },
  ];

  let serviceCount = 0;

  for (const entry of catalogue) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: entry.category.slug },
      update: { name: entry.category.name, position: entry.category.position },
      create: entry.category,
    });

    for (const { rooms, ...service } of entry.services) {
      const created = await prisma.service.upsert({
        where: { slug: service.slug },
        update: { ...service, categoryId: category.id },
        create: { ...service, categoryId: category.id },
      });
      serviceCount += 1;

      for (const roomSlug of rooms) {
        const roomId = roomIds.get(roomSlug);
        if (!roomId) throw new Error(`Service ${service.slug} references unknown room ${roomSlug}`);
        await prisma.roomService.upsert({
          where: { roomId_serviceId: { roomId, serviceId: created.id } },
          update: {},
          create: { roomId, serviceId: created.id },
        });
      }
    }
  }

  // Photography packages carry the deliverable terms a plain service cannot.
  const portrait = await prisma.service.findUnique({ where: { slug: 'studio-portrait' } });
  if (portrait) {
    const packages = [
      {
        name: 'Portrait — Essential',
        deliverableCount: 10,
        editTurnaroundDays: 5,
        priceCents: KES(12000),
      },
      {
        name: 'Portrait — Extended',
        deliverableCount: 25,
        editTurnaroundDays: 7,
        priceCents: KES(22000),
      },
    ];
    for (const pkg of packages) {
      const existing = await prisma.photographyPackage.findFirst({
        where: { serviceId: portrait.id, name: pkg.name },
      });
      if (existing) {
        await prisma.photographyPackage.update({ where: { id: existing.id }, data: pkg });
      } else {
        await prisma.photographyPackage.create({ data: { ...pkg, serviceId: portrait.id } });
      }
    }
  }

  console.log(`  services: ${serviceCount} across ${catalogue.length} categories`);
}

async function seedEquipment(): Promise<void> {
  const catalogue = [
    {
      category: { slug: 'microphones', name: 'Microphones' },
      items: [
        {
          name: 'Shure SM7B',
          assetTag: 'BMD-MIC-001',
          dailyRateCents: KES(1500),
          depositCents: KES(10000),
        },
        {
          name: 'Shure SM7B',
          assetTag: 'BMD-MIC-002',
          dailyRateCents: KES(1500),
          depositCents: KES(10000),
        },
        {
          name: 'Rode NT1-A',
          assetTag: 'BMD-MIC-003',
          dailyRateCents: KES(1200),
          depositCents: KES(8000),
        },
        {
          name: 'Rode Wireless GO II',
          assetTag: 'BMD-MIC-004',
          dailyRateCents: KES(2000),
          depositCents: KES(12000),
        },
      ],
    },
    {
      category: { slug: 'cameras', name: 'Cameras & Lenses' },
      items: [
        {
          name: 'Sony A7 III',
          assetTag: 'BMD-CAM-001',
          dailyRateCents: KES(6000),
          depositCents: KES(50000),
        },
        {
          name: 'Sony A7 III',
          assetTag: 'BMD-CAM-002',
          dailyRateCents: KES(6000),
          depositCents: KES(50000),
        },
        {
          name: 'Canon EOS R6',
          assetTag: 'BMD-CAM-003',
          dailyRateCents: KES(6500),
          depositCents: KES(55000),
        },
        {
          name: 'Sigma 24-70mm f/2.8',
          assetTag: 'BMD-LEN-001',
          dailyRateCents: KES(2500),
          depositCents: KES(20000),
        },
      ],
    },
    {
      category: { slug: 'lighting', name: 'Lighting' },
      items: [
        {
          name: 'Aputure 300D II',
          assetTag: 'BMD-LGT-001',
          dailyRateCents: KES(3500),
          depositCents: KES(25000),
        },
        {
          name: 'Godox SL60W',
          assetTag: 'BMD-LGT-002',
          dailyRateCents: KES(1800),
          depositCents: KES(12000),
        },
        {
          name: 'Softbox Kit 90cm',
          assetTag: 'BMD-LGT-003',
          dailyRateCents: KES(900),
          depositCents: KES(5000),
        },
      ],
    },
    {
      category: { slug: 'audio-interfaces', name: 'Audio Interfaces & Mixers' },
      items: [
        {
          name: 'RodeCaster Pro II',
          assetTag: 'BMD-AUD-001',
          dailyRateCents: KES(4000),
          depositCents: KES(30000),
        },
        {
          name: 'Focusrite Scarlett 18i20',
          assetTag: 'BMD-AUD-002',
          dailyRateCents: KES(2500),
          depositCents: KES(18000),
        },
      ],
    },
    {
      category: { slug: 'support', name: 'Stands, Rigs & Support' },
      items: [
        {
          name: 'Manfrotto Tripod 055',
          assetTag: 'BMD-SUP-001',
          dailyRateCents: KES(1000),
          depositCents: KES(7000),
        },
        {
          name: 'DJI RS 3 Gimbal',
          assetTag: 'BMD-SUP-002',
          dailyRateCents: KES(3000),
          depositCents: KES(22000),
        },
      ],
    },
  ];

  let count = 0;
  for (const entry of catalogue) {
    const category = await prisma.equipmentCategory.upsert({
      where: { slug: entry.category.slug },
      update: { name: entry.category.name },
      create: entry.category,
    });

    for (const item of entry.items) {
      await prisma.equipment.upsert({
        where: { assetTag: item.assetTag },
        update: { ...item, categoryId: category.id },
        create: {
          ...item,
          categoryId: category.id,
          condition: 'GOOD',
          status: 'AVAILABLE',
          location: 'Main store',
        },
      });
      count += 1;
    }
  }

  console.log(`  equipment: ${count} units across ${catalogue.length} categories`);
}

async function seedShows(roomIds: Map<string, string>): Promise<void> {
  const liveRoomId = roomIds.get('live-room');
  const validFrom = new Date('2026-01-01T00:00:00Z');

  const shows = [
    {
      slug: 'morning-drive',
      name: 'Morning Drive',
      description: 'News, traffic and conversation to start the day.',
      category: 'Talk',
      // Weekdays 06:00–10:00 local.
      schedule: { weekdays: [1, 2, 3, 4, 5], startMinute: 6 * 60, endMinute: 10 * 60 },
    },
    {
      slug: 'the-midday-mix',
      name: 'The Midday Mix',
      description: 'Music, requests and dedications through the afternoon.',
      category: 'Music',
      schedule: { weekdays: [1, 2, 3, 4, 5], startMinute: 12 * 60, endMinute: 15 * 60 },
    },
    {
      slug: 'evening-sessions',
      name: 'Evening Sessions',
      description: 'Live guests and studio performances.',
      category: 'Live',
      schedule: { weekdays: [1, 3, 5], startMinute: 18 * 60, endMinute: 20 * 60 },
    },
    {
      slug: 'weekend-countdown',
      name: 'Weekend Countdown',
      description: 'The week in charts, counted down on Saturday.',
      category: 'Music',
      schedule: { weekdays: [6], startMinute: 14 * 60, endMinute: 17 * 60 },
    },
  ];

  for (const { schedule, ...show } of shows) {
    const created = await prisma.show.upsert({
      where: { slug: show.slug },
      update: show,
      create: { ...show, isActive: true },
    });

    // A show has at most one baseline schedule from the seed; match on the
    // show rather than blindly creating, so re-running does not stack rules.
    const existing = await prisma.showSchedule.findFirst({ where: { showId: created.id } });
    const data = { ...schedule, roomId: liveRoomId ?? null, validFrom, isActive: true };

    if (existing) {
      await prisma.showSchedule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.showSchedule.create({ data: { ...data, showId: created.id } });
    }
  }

  console.log(`  shows: ${shows.length} with weekly schedules`);
}

async function seedSettings(): Promise<void> {
  const settings: Array<{ key: string; value: Prisma.InputJsonValue; description: string }> = [
    {
      key: 'booking.cancellation_window_hours',
      value: 24,
      description:
        'Hours before start within which a customer may no longer cancel free of charge.',
    },
    {
      key: 'booking.max_advance_days',
      value: 90,
      description: 'How far ahead a customer may book.',
    },
    {
      key: 'booking.deposit_percent',
      value: 50,
      description: 'Percentage of the total required to confirm a booking.',
    },
    {
      key: 'rental.late_fee_percent_per_day',
      value: 25,
      description: 'Late fee per overdue day, as a percentage of the daily rate.',
    },
    {
      key: 'tax.vat_percent',
      value: 16,
      description: 'Kenyan VAT rate applied to invoices.',
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { description: setting.description },
      // An operator's changed value is never overwritten by a later seed run.
      create: setting,
    });
  }

  console.log(`  settings: ${settings.length}`);
}

async function main(): Promise<void> {
  console.log('Seeding B.M.D Studio database…');

  const permissionIds = await seedPermissions();
  const roleIds = await seedRoles(permissionIds);
  await seedAdminUser(roleIds);

  const studioId = await seedStudio();
  const roomIds = await seedRooms(studioId);
  await seedServices(roomIds);
  await seedEquipment();
  await seedShows(roomIds);
  await seedSettings();

  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
