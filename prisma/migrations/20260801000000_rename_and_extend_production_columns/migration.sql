-- Phase 1 of the stats↔production-sheets bridge.
--
--  1. Fix the two column typos on production_entries + production_targets:
--     cell_connects → call_connects   ("Cell Connects" was really "Call Connects")
--     basis_units   → basic_units     ("Basis Units"  was really "Basic Units")
--  2. Add the two KPIs /admin/stats tracks but production_entries didn't have
--     a column for: dm_numbers + appointments_that_show.
--
-- RENAME preserves the existing data — no backfill needed. New columns land
-- NULL for existing rows, which the entry grid renders as blank cells.

-- ---- production_entries ----
ALTER TABLE "production_entries"
  RENAME COLUMN "cell_connects" TO "call_connects";
ALTER TABLE "production_entries"
  RENAME COLUMN "basis_units"   TO "basic_units";
ALTER TABLE "production_entries"
  ADD COLUMN "dm_numbers"             INTEGER,
  ADD COLUMN "appointments_that_show" INTEGER;

-- ---- production_targets ----
ALTER TABLE "production_targets"
  RENAME COLUMN "cell_connects" TO "call_connects";
ALTER TABLE "production_targets"
  RENAME COLUMN "basis_units"   TO "basic_units";
ALTER TABLE "production_targets"
  ADD COLUMN "dm_numbers"             INTEGER,
  ADD COLUMN "appointments_that_show" INTEGER;
