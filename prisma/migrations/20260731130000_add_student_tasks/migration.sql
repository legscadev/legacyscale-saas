-- Personal to-do list surfaced on /dashboard + /tasks. One row per
-- student task/goal, private to its owner. Optional deep-links back
-- into the LMS course/lesson so a "Finish Module 3" task jumps
-- straight to the lesson.

CREATE TABLE "student_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "linked_course_id" TEXT,
    "linked_lesson_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "student_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_tasks_user_id_completed_at_due_date_idx"
    ON "student_tasks"("user_id", "completed_at", "due_date");

CREATE INDEX "student_tasks_company_id_user_id_idx"
    ON "student_tasks"("company_id", "user_id");

ALTER TABLE "student_tasks"
    ADD CONSTRAINT "student_tasks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_tasks"
    ADD CONSTRAINT "student_tasks_linked_course_id_fkey"
    FOREIGN KEY ("linked_course_id") REFERENCES "courses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_tasks"
    ADD CONSTRAINT "student_tasks_linked_lesson_id_fkey"
    FOREIGN KEY ("linked_lesson_id") REFERENCES "lessons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
