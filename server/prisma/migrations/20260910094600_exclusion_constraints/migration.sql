-- ===========================================================================
-- Overlap prevention (plan.md §4.2, risk R1)
--
-- Hand-written because Prisma cannot express EXCLUDE constraints, CHECK
-- constraints or triggers. This file is the single reason two customers cannot
-- be sold the same room for the same hour: the guarantee is enforced by
-- PostgreSQL, so it holds no matter how many application servers are running,
-- and it holds even if the service layer has a bug.
--
-- The ranges are written as `tstzrange(starts_at, ends_at, '[)')` expressions
-- rather than stored generated columns. The guarantee is identical, and it
-- keeps the physical schema free of columns Prisma does not know about, so
-- `prisma migrate dev` never proposes dropping them.
--
-- `[)` is half-open on purpose: a booking that ends at 14:00 does not collide
-- with one that starts at 14:00.
-- ===========================================================================

-- Required to mix scalar equality (`room_id WITH =`) with range overlap
-- (`WITH &&`) inside one GiST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Sanity: a period must move forwards. Without this, an inverted range would
-- raise a runtime error inside the exclusion constraint instead of a clear
-- validation failure, and a zero-length range would silently collide with
-- nothing at all.
-- ---------------------------------------------------------------------------

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_period_forward"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "equipment_rentals"
  ADD CONSTRAINT "equipment_rentals_period_forward"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "equipment_rental_items"
  ADD CONSTRAINT "equipment_rental_items_period_forward"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "show_occurrences"
  ADD CONSTRAINT "show_occurrences_period_forward"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "blackout_periods"
  ADD CONSTRAINT "blackout_periods_period_forward"
  CHECK ("ends_at" > "starts_at");

-- Money never goes negative, and a total is never below zero after discount.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_amounts_non_negative"
  CHECK (
    "subtotal_cents" >= 0 AND
    "discount_cents" >= 0 AND
    "tax_cents"      >= 0 AND
    "total_cents"    >= 0
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive"
  CHECK ("amount_cents" > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive"
  CHECK ("amount_cents" > 0);

-- ---------------------------------------------------------------------------
-- 1. Bookings: one room, one booking, one instant.
--
-- The predicate lists only the statuses that actually hold the room. A
-- CANCELLED, COMPLETED, NO_SHOW or RESCHEDULED booking releases its slot the
-- moment its status changes, with no row deletion and no history lost.
-- ---------------------------------------------------------------------------

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN (
    'PENDING_PAYMENT',
    'PENDING_APPROVAL',
    'CONFIRMED',
    'IN_PROGRESS'
  ));

-- ---------------------------------------------------------------------------
-- 2. Equipment: one physical unit cannot be out twice over the same window.
--
-- `rental_status` is denormalised onto the item because an exclusion
-- constraint's predicate cannot join to the parent rental. The trigger below
-- keeps it truthful, so the mirror is maintained by the database rather than
-- trusted to application code.
-- ---------------------------------------------------------------------------

ALTER TABLE "equipment_rental_items"
  ADD CONSTRAINT "equipment_rental_items_no_overlap"
  EXCLUDE USING gist (
    "equipment_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("rental_status" IN (
    'PENDING_APPROVAL',
    'APPROVED',
    'CHECKED_OUT',
    'OVERDUE'
  ));

CREATE OR REPLACE FUNCTION "equipment_rental_items_sync_status"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    UPDATE "equipment_rental_items"
       SET "rental_status" = NEW."status",
           "updated_at"    = now()
     WHERE "rental_id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "equipment_rentals_status_sync"
  AFTER UPDATE OF "status" ON "equipment_rentals"
  FOR EACH ROW
  EXECUTE FUNCTION "equipment_rental_items_sync_status"();

-- An item inserted against an existing rental inherits that rental's status,
-- so a row can never be created with a stale mirror.
CREATE OR REPLACE FUNCTION "equipment_rental_items_inherit_status"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT "status" INTO NEW."rental_status"
    FROM "equipment_rentals"
   WHERE "id" = NEW."rental_id";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "equipment_rental_items_inherit"
  BEFORE INSERT ON "equipment_rental_items"
  FOR EACH ROW
  EXECUTE FUNCTION "equipment_rental_items_inherit_status"();

-- ---------------------------------------------------------------------------
-- 3. Shows: two shows cannot claim the same room at the same time.
--
-- `room_id` is nullable (a show need not occupy a physical room). A NULL room
-- is excluded from the constraint entirely, because NULL is not equal to
-- anything and such an airing conflicts with nobody.
-- ---------------------------------------------------------------------------

ALTER TABLE "show_occurrences"
  ADD CONSTRAINT "show_occurrences_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("room_id" IS NOT NULL AND "status" IN ('SCHEDULED', 'LIVE'));

-- ---------------------------------------------------------------------------
-- 4. Read paths that the availability engine leans on.
--
-- The exclusion constraints above create GiST indexes usable for overlap
-- lookups; these cover the remaining hot queries.
-- ---------------------------------------------------------------------------

-- "Which blackouts hit this window?" for a whole studio or a single room.
CREATE INDEX "blackout_periods_period_idx"
  ON "blackout_periods"
  USING gist (tstzrange("starts_at", "ends_at", '[)'));

-- "What is on air right now?" — the partial index keeps this tiny, because at
-- most a handful of rows are ever LIVE.
CREATE INDEX "show_occurrences_live_idx"
  ON "show_occurrences" ("starts_at")
  WHERE ("status" = 'LIVE');

-- Equipment unavailable for maintenance over a window. `ends_at` is nullable
-- for open-ended work; COALESCE to a far-future bound so an open ticket
-- correctly blocks every later rental.
CREATE INDEX "equipment_maintenance_period_idx"
  ON "equipment_maintenance"
  USING gist (
    "equipment_id",
    tstzrange("starts_at", COALESCE("ends_at", 'infinity'::timestamptz), '[)')
  );
