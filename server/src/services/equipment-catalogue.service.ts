import type {
  EquipmentConditionValue,
  EquipmentStatusValue,
  PublicEquipmentCategory,
  PublicEquipmentItem,
} from '@bmd/shared';
import { prisma } from '../lib/prisma.js';

interface UnitRow {
  name: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  dailyRateCents: number;
  depositCents: number;
  status: EquipmentStatusValue;
  condition: EquipmentConditionValue;
}

/**
 * A unit can go out right now only when it is on the shelf and fit to use.
 * Damaged stock still counts towards the fleet but is never offered.
 */
export function isRentableNow(unit: Pick<UnitRow, 'status' | 'condition'>): boolean {
  return unit.status === 'AVAILABLE' && unit.condition !== 'DAMAGED';
}

/**
 * The public hire catalogue, grouped by category and collapsed from physical
 * units into the products a customer chooses between.
 */
export async function getEquipmentCatalogue(): Promise<PublicEquipmentCategory[]> {
  const categories = await prisma.equipmentCategory.findMany({
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      name: true,
      description: true,
      equipment: {
        // Retired stock has left the fleet for good.
        where: { status: { not: 'RETIRED' } },
        orderBy: [{ name: 'asc' }, { dailyRateCents: 'asc' }],
        // Asset tags, serial numbers and store locations are operational detail
        // and never leave the server on a public route.
        select: {
          name: true,
          description: true,
          manufacturer: true,
          model: true,
          dailyRateCents: true,
          depositCents: true,
          status: true,
          condition: true,
        },
      },
    },
  });

  return categories
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      description: category.description,
      items: groupUnits(category.equipment),
    }))
    .filter((category) => category.items.length > 0);
}

/**
 * Units are the same product when they share a name, make, model and hire
 * terms; the same microphone offered at two different rates is listed twice.
 */
function groupUnits(units: UnitRow[]): PublicEquipmentItem[] {
  const products = new Map<string, PublicEquipmentItem>();

  for (const unit of units) {
    const key = productKey(unit);
    const rentable = isRentableNow(unit) ? 1 : 0;
    const existing = products.get(key);

    if (existing) {
      existing.unitCount += 1;
      existing.availableCount += rentable;
      existing.description ??= unit.description;
      continue;
    }

    products.set(key, {
      key,
      name: unit.name,
      description: unit.description,
      manufacturer: unit.manufacturer,
      model: unit.model,
      dailyRateCents: unit.dailyRateCents,
      depositCents: unit.depositCents,
      unitCount: 1,
      availableCount: rentable,
    });
  }

  return [...products.values()];
}

function productKey(unit: UnitRow): string {
  const label = [unit.name, unit.manufacturer, unit.model]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${label}-${unit.dailyRateCents}-${unit.depositCents}`;
}
