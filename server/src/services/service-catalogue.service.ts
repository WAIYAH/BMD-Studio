import type { Prisma } from '@prisma/client';
import type { PublicServiceCategory } from '@bmd/shared';
import { prisma } from '../lib/prisma.js';

/**
 * A room link only counts when the room is open for use in an active studio. A
 * service with no such room has nowhere to happen, so listing it would
 * advertise something the booking engine must refuse.
 */
const DELIVERABLE_ROOM = {
  room: { status: 'ACTIVE', studio: { isActive: true } },
} satisfies Prisma.RoomServiceWhereInput;

/**
 * The public service catalogue: every active service a visitor could actually
 * book, grouped by category. Prices are the stored integer cents set by studio
 * staff; nothing here is estimated or invented.
 */
export async function getServiceCatalogue(): Promise<PublicServiceCategory[]> {
  const categories = await prisma.serviceCategory.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      description: true,
      services: {
        where: { isActive: true, rooms: { some: DELIVERABLE_ROOM } },
        orderBy: { name: 'asc' },
        select: {
          slug: true,
          name: true,
          description: true,
          pricingModel: true,
          basePriceCents: true,
          minDurationMin: true,
          maxDurationMin: true,
          requiresApproval: true,
          rooms: {
            where: DELIVERABLE_ROOM,
            orderBy: { room: { name: 'asc' } },
            select: {
              priceCentsOverride: true,
              room: { select: { slug: true, name: true, capacity: true } },
            },
          },
          packages: {
            where: { isActive: true },
            orderBy: { priceCents: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              deliverableCount: true,
              editTurnaroundDays: true,
              priceCents: true,
            },
          },
        },
      },
    },
  });

  return categories
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      description: category.description,
      services: category.services.map((service) => {
        const rooms = service.rooms.map(({ priceCentsOverride, room }) => ({
          slug: room.slug,
          name: room.name,
          capacity: room.capacity,
          priceCents: priceCentsOverride ?? service.basePriceCents,
        }));

        return {
          slug: service.slug,
          name: service.name,
          description: service.description,
          pricingModel: service.pricingModel,
          basePriceCents: service.basePriceCents,
          // `rooms` is never empty: the `some` filter above guarantees a room.
          fromPriceCents: Math.min(
            ...rooms.map((room) => room.priceCents),
            ...service.packages.map((pkg) => pkg.priceCents),
          ),
          minDurationMinutes: service.minDurationMin,
          maxDurationMinutes: service.maxDurationMin,
          requiresApproval: service.requiresApproval,
          rooms,
          packages: service.packages,
        };
      }),
    }))
    .filter((category) => category.services.length > 0);
}
