-- CRM — leads (P0 #2). Top of the funnel: raw inbound people before
-- qualification. Carries its original source + qualification status +
-- assigned setter; converts into a crm_opportunity (P0 #3 inserts a
-- crm_contact in between).

CREATE TYPE "CrmLeadSource" AS ENUM (
  'WEBSITE_FORM',
  'LANDING_PAGE',
  'FACEBOOK_ADS',
  'GOOGLE_ADS',
  'CSV_IMPORT',
  'MANUAL',
  'API',
  'WEBHOOK',
  'OTHER'
);

CREATE TYPE "CrmLeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED'
);

CREATE TABLE "crm_leads" (
  "id"                       TEXT NOT NULL,
  "full_name"                TEXT NOT NULL,
  "email"                    TEXT,
  "phone"                    TEXT,
  "secondary_phone"          TEXT,
  "company_name"             TEXT,
  "address"                  TEXT,
  "source"                   "CrmLeadSource" NOT NULL DEFAULT 'MANUAL',
  "campaign"                 TEXT,
  "industry"                 TEXT,
  "status"                   "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
  "assigned_setter_id"       TEXT,
  "created_by_id"            TEXT,
  "notes"                    TEXT,
  "last_activity_at"         TIMESTAMP(3),
  "converted_at"             TIMESTAMP(3),
  "converted_opportunity_id" TEXT,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,
  "deleted_at"               TIMESTAMP(3),
  "company_id"               TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_leads_company_id_status_idx"
  ON "crm_leads" ("company_id", "status");
CREATE INDEX "crm_leads_company_id_assigned_setter_id_idx"
  ON "crm_leads" ("company_id", "assigned_setter_id");
CREATE INDEX "crm_leads_company_id_source_idx"
  ON "crm_leads" ("company_id", "source");
CREATE INDEX "crm_leads_company_id_deleted_at_idx"
  ON "crm_leads" ("company_id", "deleted_at");
CREATE INDEX "crm_leads_company_id_email_idx"
  ON "crm_leads" ("company_id", "email");
CREATE INDEX "crm_leads_company_id_phone_idx"
  ON "crm_leads" ("company_id", "phone");

ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assigned_setter_id_fkey"
  FOREIGN KEY ("assigned_setter_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_opportunity_id_fkey"
  FOREIGN KEY ("converted_opportunity_id") REFERENCES "crm_opportunities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
