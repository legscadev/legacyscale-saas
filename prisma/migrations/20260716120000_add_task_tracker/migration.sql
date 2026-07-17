-- Phase 1.1 — Internal Task Tracker foundation.
--
-- Twelve new tables + one enum. Every table is tenant-scoped via a
-- companyId column defaulting to the Legacy Scale seed row. Cascades
-- follow the same conventions as the rest of the schema: children
-- cascade with parents; user references SetNull so a user delete
-- never wipes a task or comment.

CREATE TYPE "TaskPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- ── task_statuses ─────────────────────────────────────────────────
CREATE TABLE "task_statuses" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "color"       TEXT NOT NULL DEFAULT '#94a3b8',
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_default"  BOOLEAN NOT NULL DEFAULT false,
  "is_terminal" BOOLEAN NOT NULL DEFAULT false,
  "wip_limit"   INTEGER,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "company_id"  TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_statuses_company_id_slug_key" ON "task_statuses"("company_id", "slug");
CREATE INDEX "task_statuses_company_id_order_index_idx" ON "task_statuses"("company_id", "order_index");

-- ── task_categories ───────────────────────────────────────────────
CREATE TABLE "task_categories" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "color"      TEXT NOT NULL DEFAULT '#94a3b8',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_categories_company_id_name_key" ON "task_categories"("company_id", "name");

-- ── task_labels ───────────────────────────────────────────────────
CREATE TABLE "task_labels" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "color"      TEXT NOT NULL DEFAULT '#94a3b8',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_labels_company_id_name_key" ON "task_labels"("company_id", "name");

-- ── tasks ─────────────────────────────────────────────────────────
CREATE TABLE "tasks" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "status_id"       TEXT NOT NULL,
  "priority"        "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "category_id"     TEXT,
  "reporter_id"     TEXT,
  "parent_task_id"  TEXT,
  "start_date"      DATE,
  "due_date"        DATE,
  "estimated_hours" DECIMAL(8, 2),
  "actual_hours"    DECIMAL(8, 2),
  "order_index"     INTEGER NOT NULL DEFAULT 0,
  "archived_at"     TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  "deleted_at"      TIMESTAMP(3),
  "company_id"      TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tasks_company_id_status_id_order_index_idx" ON "tasks"("company_id", "status_id", "order_index");
CREATE INDEX "tasks_company_id_priority_idx" ON "tasks"("company_id", "priority");
CREATE INDEX "tasks_company_id_due_date_idx" ON "tasks"("company_id", "due_date");
CREATE INDEX "tasks_company_id_category_id_idx" ON "tasks"("company_id", "category_id");
CREATE INDEX "tasks_company_id_reporter_id_idx" ON "tasks"("company_id", "reporter_id");
CREATE INDEX "tasks_company_id_archived_at_idx" ON "tasks"("company_id", "archived_at");
CREATE INDEX "tasks_company_id_deleted_at_idx" ON "tasks"("company_id", "deleted_at");

-- ── task_label_links (M:N) ────────────────────────────────────────
CREATE TABLE "task_label_links" (
  "task_id"    TEXT NOT NULL,
  "label_id"   TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_label_links_pkey" PRIMARY KEY ("task_id", "label_id")
);
CREATE INDEX "task_label_links_company_id_idx" ON "task_label_links"("company_id");

-- ── task_assignees ────────────────────────────────────────────────
CREATE TABLE "task_assignees" (
  "task_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id", "user_id")
);
CREATE INDEX "task_assignees_company_id_user_id_idx" ON "task_assignees"("company_id", "user_id");

-- ── task_watchers ─────────────────────────────────────────────────
CREATE TABLE "task_watchers" (
  "task_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("task_id", "user_id")
);
CREATE INDEX "task_watchers_company_id_user_id_idx" ON "task_watchers"("company_id", "user_id");

-- ── task_comments ─────────────────────────────────────────────────
CREATE TABLE "task_comments" (
  "id"           TEXT NOT NULL,
  "task_id"      TEXT NOT NULL,
  "author_id"    TEXT,
  "body"         TEXT NOT NULL,
  "edited_at"    TIMESTAMP(3),
  "edited_by_id" TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id"   TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_comments_company_id_task_id_created_at_idx" ON "task_comments"("company_id", "task_id", "created_at");

-- ── task_checklists ───────────────────────────────────────────────
CREATE TABLE "task_checklists" (
  "id"          TEXT NOT NULL,
  "task_id"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "company_id"  TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_checklists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_checklists_company_id_task_id_order_index_idx" ON "task_checklists"("company_id", "task_id", "order_index");

-- ── task_checklist_items ──────────────────────────────────────────
CREATE TABLE "task_checklist_items" (
  "id"           TEXT NOT NULL,
  "checklist_id" TEXT NOT NULL,
  "text"         TEXT NOT NULL,
  "is_done"      BOOLEAN NOT NULL DEFAULT false,
  "done_by_id"   TEXT,
  "done_at"      TIMESTAMP(3),
  "order_index"  INTEGER NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  "company_id"   TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_checklist_items_company_id_checklist_id_order_index_idx" ON "task_checklist_items"("company_id", "checklist_id", "order_index");

-- ── task_attachments ──────────────────────────────────────────────
CREATE TABLE "task_attachments" (
  "id"             TEXT NOT NULL,
  "task_id"        TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "path"           TEXT NOT NULL,
  "size"           INTEGER NOT NULL,
  "mime_type"      TEXT NOT NULL,
  "uploaded_by_id" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id"     TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_attachments_company_id_task_id_created_at_idx" ON "task_attachments"("company_id", "task_id", "created_at");

-- ── task_activity_logs ────────────────────────────────────────────
CREATE TABLE "task_activity_logs" (
  "id"         TEXT NOT NULL,
  "task_id"    TEXT NOT NULL,
  "actor_id"   TEXT,
  "action"     TEXT NOT NULL,
  "from_value" JSONB,
  "to_value"   JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  CONSTRAINT "task_activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_activity_logs_company_id_task_id_created_at_idx" ON "task_activity_logs"("company_id", "task_id", "created_at");

-- ── FK constraints ────────────────────────────────────────────────
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "task_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_label_links" ADD CONSTRAINT "task_label_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_label_links" ADD CONSTRAINT "task_label_links_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "task_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "task_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_done_by_id_fkey" FOREIGN KEY ("done_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_activity_logs" ADD CONSTRAINT "task_activity_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_activity_logs" ADD CONSTRAINT "task_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
