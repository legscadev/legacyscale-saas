-- CRM — bulk-action log (Phase 3). Persists every bulk job the
-- board dispatches (currently just DELETE against opportunities) so
-- the Bulk Actions tab can render an audit trail: who ran what,
-- when, and how many rows it touched.

CREATE TYPE "CrmBulkActionStatus" AS ENUM (
  'RUNNING',
  'COMPLETE',
  'FAILED'
);

CREATE TYPE "CrmBulkActionOperation" AS ENUM (
  'DELETE',
  'MOVE_STAGE',
  'ASSIGN_CLOSER'
);

CREATE TYPE "CrmBulkActionTargetType" AS ENUM (
  'OPPORTUNITY',
  'LEAD',
  'CONTACT'
);

CREATE TABLE "crm_bulk_actions" (
  "id"             TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "operation"      "CrmBulkActionOperation" NOT NULL,
  "target_type"    "CrmBulkActionTargetType" NOT NULL,
  "status"         "CrmBulkActionStatus" NOT NULL DEFAULT 'RUNNING',
  "target_count"   INTEGER NOT NULL DEFAULT 0,
  "success_count"  INTEGER NOT NULL DEFAULT 0,
  "failure_count"  INTEGER NOT NULL DEFAULT 0,
  "params"         JSONB,
  "error_message"  TEXT,
  "actor_id"       TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"   TIMESTAMP(3),
  "company_id"     TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "crm_bulk_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_bulk_actions_company_id_created_at_idx"
  ON "crm_bulk_actions" ("company_id", "created_at");
CREATE INDEX "crm_bulk_actions_company_id_operation_idx"
  ON "crm_bulk_actions" ("company_id", "operation");
CREATE INDEX "crm_bulk_actions_company_id_status_idx"
  ON "crm_bulk_actions" ("company_id", "status");

ALTER TABLE "crm_bulk_actions" ADD CONSTRAINT "crm_bulk_actions_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
