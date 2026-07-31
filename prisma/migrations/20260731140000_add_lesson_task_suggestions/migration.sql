-- Instructor-authored task templates pinned to a lesson. Students
-- one-click them into their personal task list (snapshot copy, so
-- later edits by the instructor don't reshape existing StudentTask
-- rows).

CREATE TABLE "lesson_task_suggestions" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "lesson_task_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lesson_task_suggestions_lesson_id_order_index_idx"
    ON "lesson_task_suggestions"("lesson_id", "order_index");

CREATE INDEX "lesson_task_suggestions_company_id_idx"
    ON "lesson_task_suggestions"("company_id");

ALTER TABLE "lesson_task_suggestions"
    ADD CONSTRAINT "lesson_task_suggestions_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
