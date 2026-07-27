-- CRM — sales pipeline (P0 #1). The GoHighLevel-style board:
-- Lead → Opportunity → Deal. Mirrors the Task Tracker shape
-- (CrmPipeline ≈ board, CrmPipelineStage ≈ TaskStatus,
-- CrmOpportunity ≈ Task) so the Kanban + seeding conventions carry
-- over. Contact is free-text on the opportunity for P0; crm_contact
-- FKs arrive in P0 #3.

CREATE TYPE "CrmOpportunityStatus" AS ENUM (
  'OPEN',
  'WON',
  'LOST'
);

-- One pipeline = one Kanban board. Exactly one row per tenant
-- should carry is_default (enforced app-side).
CREATE TABLE "crm_pipelines" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "is_default"  BOOLEAN NOT NULL DEFAULT false,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "company_id"  TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_pipelines_company_id_slug_key"
  ON "crm_pipelines" ("company_id", "slug");
CREATE INDEX "crm_pipelines_company_id_order_index_idx"
  ON "crm_pipelines" ("company_id", "order_index");

-- A column on a pipeline. is_won / is_lost mark terminal columns.
CREATE TABLE "crm_pipeline_stages" (
  "id"          TEXT NOT NULL,
  "pipeline_id" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "color"       TEXT NOT NULL DEFAULT '#94a3b8',
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "probability" INTEGER,
  "is_won"      BOOLEAN NOT NULL DEFAULT false,
  "is_lost"     BOOLEAN NOT NULL DEFAULT false,
  "wip_limit"   INTEGER,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "company_id"  TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_pipeline_stages_pipeline_id_slug_key"
  ON "crm_pipeline_stages" ("pipeline_id", "slug");
CREATE INDEX "crm_pipeline_stages_company_id_pipeline_id_order_index_idx"
  ON "crm_pipeline_stages" ("company_id", "pipeline_id", "order_index");

ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_fkey"
  FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A deal. Ordered within its stage by order_index (gaps of 100).
-- stage_id is Restrict so a stage holding deals can't be deleted.
CREATE TABLE "crm_opportunities" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "pipeline_id"         TEXT NOT NULL,
  "stage_id"            TEXT NOT NULL,
  "contact_name"        TEXT,
  "contact_email"       TEXT,
  "contact_phone"       TEXT,
  "company_name"        TEXT,
  "value"               DECIMAL(12, 2),
  "probability"         INTEGER,
  "expected_close_date" DATE,
  "assigned_closer_id"  TEXT,
  "created_by_id"       TEXT,
  "status"              "CrmOpportunityStatus" NOT NULL DEFAULT 'OPEN',
  "notes"               TEXT,
  "order_index"         INTEGER NOT NULL DEFAULT 0,
  "won_at"              TIMESTAMP(3),
  "lost_at"             TIMESTAMP(3),
  "lost_reason"         TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  "deleted_at"          TIMESTAMP(3),
  "company_id"          TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_opportunities_company_id_pipeline_id_stage_id_order_index_idx"
  ON "crm_opportunities" ("company_id", "pipeline_id", "stage_id", "order_index");
CREATE INDEX "crm_opportunities_company_id_assigned_closer_id_idx"
  ON "crm_opportunities" ("company_id", "assigned_closer_id");
CREATE INDEX "crm_opportunities_company_id_status_idx"
  ON "crm_opportunities" ("company_id", "status");
CREATE INDEX "crm_opportunities_company_id_deleted_at_idx"
  ON "crm_opportunities" ("company_id", "deleted_at");

ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipeline_id_fkey"
  FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stage_id_fkey"
  FOREIGN KEY ("stage_id") REFERENCES "crm_pipeline_stages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_assigned_closer_id_fkey"
  FOREIGN KEY ("assigned_closer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
