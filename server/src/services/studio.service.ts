import type { PublicOpeningHours, PublicStudio } from '@bmd/shared';
import { prisma } from '../lib/prisma.js';

/** Sort key that puts Monday first and Sunday last. */
const mondayFirst = (weekday: number): number => (weekday + 6) % 7;

/** Active studios with their published hours, contact details and open rooms. */
export async function getPublicStudios(): Promise<PublicStudio[]> {
  const studios = await prisma.studio.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      name: true,
      branch: true,
      description: true,
      addressLine: true,
      city: true,
      county: true,
      phone: true,
      email: true,
      latitude: true,
      longitude: true,
      timezone: true,
      operatingHours: {
        select: { weekday: true, openMinute: true, closeMinute: true, isClosed: true },
      },
      rooms: {
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { slug: true, name: true, description: true, capacity: true },
      },
    },
  });

  return studios.map(({ operatingHours, latitude, longitude, ...studio }) => ({
    ...studio,
    location: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    hours: [...operatingHours]
      .sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday))
      .map((day): PublicOpeningHours =>
        day.isClosed
          ? { weekday: day.weekday, isClosed: true }
          : {
              weekday: day.weekday,
              isClosed: false,
              openMinute: day.openMinute,
              closeMinute: day.closeMinute,
            },
      ),
  }));
}
