import type { PricingModelValue } from './domain.js';
import type { Cents } from './money.js';

/**
 * Public catalogue payloads: what an anonymous visitor may see about services
 * and hire equipment. These are deliberately narrower than the database rows —
 * internal ids, asset tags, serial numbers and store locations never appear.
 */

/** How a service's price is quoted to a customer. */
export const PRICING_MODEL_UNIT: Record<PricingModelValue, string> = {
  HOURLY: 'per hour',
  SESSION: 'per session',
  PACKAGE: 'per package',
};

export interface PublicServiceRoom {
  slug: string;
  name: string;
  capacity: number;
  /** The room's own override when one is set, otherwise the service base price. */
  priceCents: Cents;
}

export interface PublicPhotographyPackage {
  id: string;
  name: string;
  description: string | null;
  deliverableCount: number;
  editTurnaroundDays: number;
  priceCents: Cents;
}

export interface PublicService {
  slug: string;
  name: string;
  description: string | null;
  pricingModel: PricingModelValue;
  basePriceCents: Cents;
  /** Lowest price across the rooms and packages that deliver this service. */
  fromPriceCents: Cents;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  /** Sessions start, and lengthen, on this cadence. */
  slotIntervalMinutes: number;
  requiresApproval: boolean;
  rooms: PublicServiceRoom[];
  packages: PublicPhotographyPackage[];
}

export interface PublicServiceCategory {
  slug: string;
  name: string;
  description: string | null;
  services: PublicService[];
}

/** Physical units of the same product and terms, collapsed into one listing. */
export interface PublicEquipmentItem {
  /** Stable identifier for the grouped product; not a database id. */
  key: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  dailyRateCents: Cents;
  depositCents: Cents;
  /** Units in the fleet, excluding retired stock. */
  unitCount: number;
  /** Units on the shelf and fit to go out right now. */
  availableCount: number;
}

export interface PublicEquipmentCategory {
  slug: string;
  name: string;
  description: string | null;
  items: PublicEquipmentItem[];
}
