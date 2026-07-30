-- P0 #3: link each opportunity to a Contact (crm_leads row).
-- GHL model: Opportunity → Contact FK. One contact can own many
-- opportunities over time.

ALTER TABLE "crm_opportunities" ADD COLUMN "contact_id" TEXT;

CREATE INDEX "crm_opportunities_company_id_contact_id_idx"
    ON "crm_opportunities"("company_id", "contact_id");

ALTER TABLE "crm_opportunities"
    ADD CONSTRAINT "crm_opportunities_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "crm_leads"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: for every legacy opportunity with contact free-text
-- fields but no contact_id, either link to an existing lead
-- (dedupe by email, fallback to full name within the same tenant)
-- or spawn a fresh lead so no historical row is left dangling.

-- Step 1 — insert leads for opportunities that don't match any
-- existing lead in the same tenant. `CONVERTED` status marks them
-- as ones that already own a deal.
INSERT INTO "crm_leads" (
    "id",
    "full_name",
    "email",
    "phone",
    "company_name",
    "company_id",
    "source",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    COALESCE(
        NULLIF(TRIM(o."contact_name"), ''),
        NULLIF(TRIM(o."contact_email"), ''),
        'Unnamed contact'
    ),
    NULLIF(TRIM(o."contact_email"), ''),
    NULLIF(TRIM(o."contact_phone"), ''),
    NULLIF(TRIM(o."company_name"), ''),
    o."company_id",
    'MANUAL'::"CrmLeadSource",
    'CONVERTED'::"CrmLeadStatus",
    o."created_at",
    NOW()
FROM "crm_opportunities" o
WHERE o."contact_id" IS NULL
  AND o."deleted_at" IS NULL
  AND (
      NULLIF(TRIM(o."contact_email"), '') IS NOT NULL
      OR NULLIF(TRIM(o."contact_name"), '') IS NOT NULL
  )
  AND NOT EXISTS (
      SELECT 1
      FROM "crm_leads" l
      WHERE l."company_id" = o."company_id"
        AND l."deleted_at" IS NULL
        AND (
            (
                NULLIF(TRIM(o."contact_email"), '') IS NOT NULL
                AND LOWER(l."email") = LOWER(TRIM(o."contact_email"))
            )
            OR (
                NULLIF(TRIM(o."contact_email"), '') IS NULL
                AND NULLIF(TRIM(o."contact_name"), '') IS NOT NULL
                AND LOWER(l."full_name") = LOWER(TRIM(o."contact_name"))
            )
        )
  );

-- Step 2 — every opportunity now has a matching lead; wire the FK.
UPDATE "crm_opportunities" o
SET "contact_id" = matched.id
FROM (
    SELECT DISTINCT ON (o."id")
        o."id" AS opp_id,
        l."id"
    FROM "crm_opportunities" o
    JOIN "crm_leads" l
      ON l."company_id" = o."company_id"
     AND l."deleted_at" IS NULL
     AND (
         (
             NULLIF(TRIM(o."contact_email"), '') IS NOT NULL
             AND LOWER(l."email") = LOWER(TRIM(o."contact_email"))
         )
         OR (
             NULLIF(TRIM(o."contact_email"), '') IS NULL
             AND NULLIF(TRIM(o."contact_name"), '') IS NOT NULL
             AND LOWER(l."full_name") = LOWER(TRIM(o."contact_name"))
         )
     )
    WHERE o."contact_id" IS NULL
      AND o."deleted_at" IS NULL
    ORDER BY o."id", l."created_at" ASC
) matched
WHERE o."id" = matched.opp_id
  AND o."contact_id" IS NULL;
