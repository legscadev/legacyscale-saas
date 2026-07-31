-- Phase 3 of the stats↔production-sheets bridge.
--
-- Flag the pre-bridge, hand-created per-user sales metrics ("Michael
-- Chacon - DMs", "Jadon Tafolla - Phone Calls", etc.) so the UI can
-- badge them "Manual entry" and admins can tell them apart from the
-- live bridge cards that render alongside them on /admin/stats. The
-- rows are otherwise left in place — nothing is deleted, so any
-- historic StatDataPoints still surface.

ALTER TABLE "stat_metrics"
  ADD COLUMN "is_legacy_manual" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any metric whose name starts with a known setter/closer's
-- name followed by " - " is one of the 21 hand-created rows we're
-- flagging. No-op on databases that don't have those rows (local
-- dev), only fires on prod.
UPDATE "stat_metrics"
SET "is_legacy_manual" = true
WHERE deleted_at IS NULL
  AND (name LIKE 'Michael Chacon - %' OR name LIKE 'Jadon Tafolla - %');
