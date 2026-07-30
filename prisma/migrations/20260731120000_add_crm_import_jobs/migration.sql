-- CRM import history — one row per CSV import wizard run. Powers
-- the /admin/crm/import/history page and the "Previous imports"
-- link on the wizard.

CREATE TYPE "CrmImportJobObject" AS ENUM ('CONTACTS', 'OPPORTUNITIES');
CREATE TYPE "CrmImportJobMode" AS ENUM (
    'CREATE_ONLY',
    'CREATE_OR_UPDATE',
    'UPDATE_ONLY'
);
CREATE TYPE "CrmImportJobStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

CREATE TABLE "crm_import_jobs" (
    "id" TEXT NOT NULL,
    "object" "CrmImportJobObject" NOT NULL,
    "mode" "CrmImportJobMode" NOT NULL,
    "status" "CrmImportJobStatus" NOT NULL DEFAULT 'RUNNING',
    "file_name" TEXT,
    "file_size" INTEGER,
    "rows_total" INTEGER NOT NULL DEFAULT 0,
    "rows_created" INTEGER NOT NULL DEFAULT 0,
    "rows_updated" INTEGER NOT NULL DEFAULT 0,
    "rows_skipped" INTEGER NOT NULL DEFAULT 0,
    "rows_failed" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "error_message" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "crm_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_import_jobs_company_id_created_at_idx"
    ON "crm_import_jobs"("company_id", "created_at");

CREATE INDEX "crm_import_jobs_company_id_actor_id_created_at_idx"
    ON "crm_import_jobs"("company_id", "actor_id", "created_at");

ALTER TABLE "crm_import_jobs"
    ADD CONSTRAINT "crm_import_jobs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
