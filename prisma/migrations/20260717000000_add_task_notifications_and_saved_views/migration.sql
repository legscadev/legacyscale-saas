-- ============================================
-- TASK NOTIFICATIONS (Phase 7.1)
-- ============================================

CREATE TABLE "task_notifications" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "task_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "task_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_notifications_recipient_id_read_at_created_at_idx"
    ON "task_notifications" ("recipient_id", "read_at", "created_at");

CREATE INDEX "task_notifications_company_id_task_id_idx"
    ON "task_notifications" ("company_id", "task_id");

ALTER TABLE "task_notifications"
    ADD CONSTRAINT "task_notifications_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_notifications"
    ADD CONSTRAINT "task_notifications_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_notifications"
    ADD CONSTRAINT "task_notifications_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- TASK SAVED VIEWS (Phase 7.2)
-- ============================================

CREATE TABLE "task_saved_views" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "task_saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_saved_views_user_id_company_id_name_key"
    ON "task_saved_views" ("user_id", "company_id", "name");

CREATE INDEX "task_saved_views_company_id_user_id_idx"
    ON "task_saved_views" ("company_id", "user_id");

ALTER TABLE "task_saved_views"
    ADD CONSTRAINT "task_saved_views_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
