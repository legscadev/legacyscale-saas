-- Drop the `vfp` column from `org_nodes`. VFP (Hubbard "Valuable Final
-- Product") was removed from the UI + service layer; the column is now
-- dead weight.
ALTER TABLE "org_nodes" DROP COLUMN IF EXISTS "vfp";
