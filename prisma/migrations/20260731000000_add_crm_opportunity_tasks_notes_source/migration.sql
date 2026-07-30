-- Opportunity source (free-text lead source label)
ALTER TABLE "crm_opportunities" ADD COLUMN "source" TEXT;

-- Opportunity tasks (to-do items pinned to a deal)
CREATE TABLE "crm_opportunity_tasks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "assignee_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_opportunity_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_opportunity_tasks_company_id_opportunity_id_completed_a_idx"
    ON "crm_opportunity_tasks"("company_id", "opportunity_id", "completed_at");

CREATE INDEX "crm_opportunity_tasks_company_id_assignee_id_idx"
    ON "crm_opportunity_tasks"("company_id", "assignee_id");

ALTER TABLE "crm_opportunity_tasks"
    ADD CONSTRAINT "crm_opportunity_tasks_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_opportunity_tasks"
    ADD CONSTRAINT "crm_opportunity_tasks_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_opportunity_tasks"
    ADD CONSTRAINT "crm_opportunity_tasks_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Opportunity notes (multi-note timeline; distinct from the single
-- free-text `notes` field on crm_opportunities used by CSV imports)
CREATE TABLE "crm_opportunity_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_opportunity_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_opportunity_notes_company_id_opportunity_id_created_at_idx"
    ON "crm_opportunity_notes"("company_id", "opportunity_id", "created_at");

ALTER TABLE "crm_opportunity_notes"
    ADD CONSTRAINT "crm_opportunity_notes_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_opportunity_notes"
    ADD CONSTRAINT "crm_opportunity_notes_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
