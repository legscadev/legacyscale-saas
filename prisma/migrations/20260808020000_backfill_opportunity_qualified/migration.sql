-- Corrective backfill. The prior migration matched the old misspelled
-- stage "Qualified Aplication", which has since been renamed to
-- "Qualified Application" — so it set nothing. Re-run against the
-- current stage names so existing cards show the qualified badge.
--
-- Guarded on `qualified IS NULL` so we only fill deals that were never
-- classified — a deal already carrying a funnel-set flag is left alone
-- even if it's since been dragged to a different stage.
UPDATE "crm_opportunities" o
SET "qualified" = TRUE
FROM "crm_pipeline_stages" s
WHERE o."stage_id" = s."id"
  AND o."qualified" IS NULL
  AND lower(s."name") = 'qualified application';

UPDATE "crm_opportunities" o
SET "qualified" = FALSE
FROM "crm_pipeline_stages" s
WHERE o."stage_id" = s."id"
  AND o."qualified" IS NULL
  AND lower(s."name") = 'unqualified application';
