-- ===========================================================================
-- Booking engine (docs/CUSTOMER_PORTAL_PLAN.md phase A)
--
-- Three things a customer-facing booking flow needs that the schema did not
-- yet carry:
--
--   * a turnaround buffer that the DATABASE enforces, not application code,
--   * the deposit as quoted at the time of booking, and
--   * an expiry on the room an unpaid booking is holding.
-- ===========================================================================

ALTER TABLE "bookings"
  ADD COLUMN "package_id"      TEXT,
  ADD COLUMN "blocked_until"   TIMESTAMPTZ(3),
  ADD COLUMN "deposit_cents"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "hold_expires_at" TIMESTAMPTZ(3);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "photography_packages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bookings_package_id_idx" ON "bookings"("package_id");

-- The turnaround can only extend a booking, never shorten it.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_blocked_until_after_end"
  CHECK ("blocked_until" IS NULL OR "blocked_until" >= "ends_at");

-- A deposit is part of the total, never more than it.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_deposit_within_total"
  CHECK ("deposit_cents" >= 0 AND "deposit_cents" <= "total_cents");

-- ---------------------------------------------------------------------------
-- Rebuild the overlap guard so it covers the turnaround as well as the
-- session. Rooms carry `buffer_minutes` and services may carry their own; the
-- booking service stores the later of the two as `blocked_until`.
--
-- COALESCE keeps every existing row valid: a booking with no recorded
-- turnaround blocks exactly its own window, which is what the previous
-- constraint said. The expression is immutable, so it can be indexed —
-- `ends_at + interval` would not be, because interval arithmetic depends on
-- the session time zone.
-- ---------------------------------------------------------------------------

ALTER TABLE "bookings" DROP CONSTRAINT "bookings_no_overlap";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id"                                                        WITH =,
    tstzrange("starts_at", COALESCE("blocked_until", "ends_at"), '[)') WITH &&
  )
  WHERE ("status" IN (
    'PENDING_PAYMENT',
    'PENDING_APPROVAL',
    'CONFIRMED',
    'IN_PROGRESS'
  ));

-- The hold sweep asks one question every minute: which unpaid bookings have
-- run out of time? A partial index keeps that lookup proportional to the
-- handful of rows actually holding a room.
CREATE INDEX "bookings_hold_expiry_idx"
  ON "bookings" ("hold_expires_at")
  WHERE ("status" = 'PENDING_PAYMENT' AND "hold_expires_at" IS NOT NULL);
