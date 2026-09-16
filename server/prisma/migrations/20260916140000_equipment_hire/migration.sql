-- ===========================================================================
-- Equipment hire (docs/CUSTOMER_PORTAL_PLAN.md phase C)
--
-- A hire is quoted like a booking: a charge, VAT on that charge, and a
-- refundable deposit held while the equipment is out. The deposit is not a
-- sale, so it is never taxed — which is why VAT needs its own column rather
-- than being inferred from the total.
-- ===========================================================================

ALTER TABLE "equipment_rentals"
  ADD COLUMN "tax_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "equipment_rentals"
  ADD CONSTRAINT "equipment_rentals_amounts_non_negative"
  CHECK (
    "subtotal_cents"   >= 0 AND
    "tax_cents"        >= 0 AND
    "deposit_cents"    >= 0 AND
    "late_fee_cents"   >= 0 AND
    "damage_fee_cents" >= 0 AND
    "total_cents"      >= 0
  );
