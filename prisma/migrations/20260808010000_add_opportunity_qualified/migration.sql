-- Durable funnel qualification flag on a deal. Set once at application
-- completion so the qualified/unqualified status persists as the card
-- moves across later stages (Called 1x, Appointment Set, …).
ALTER TABLE "crm_opportunities" ADD COLUMN "qualified" BOOLEAN;

-- Backfill from the stage each deal currently sits in, so existing cards
-- show the badge immediately. Stage names match what the funnel routes to
-- (case-insensitive); the "Aplication" spelling mirrors the CRM stage.
UPDATE "crm_opportunities" o
SET "qualified" = TRUE
FROM "crm_pipeline_stages" s
WHERE o."stage_id" = s."id" AND lower(s."name") = 'qualified aplication';

UPDATE "crm_opportunities" o
SET "qualified" = FALSE
FROM "crm_pipeline_stages" s
WHERE o."stage_id" = s."id" AND lower(s."name") = 'unqualified application';
