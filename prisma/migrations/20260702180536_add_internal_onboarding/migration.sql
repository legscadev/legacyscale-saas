-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('OK', 'PENDING', 'ATTENTION', 'NA');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "role_title" TEXT NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboarding_date" TIMESTAMP(3),
    "date_started" TIMESTAMP(3),
    "offboarding_date" TIMESTAMP(3),
    "notes" TEXT,
    "template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_checklist_item_statuses" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_checklist_item_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_role_title_idx" ON "employees"("role_title");

-- CreateIndex
CREATE INDEX "employees_onboarding_date_idx" ON "employees"("onboarding_date");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklist_templates_slug_key" ON "onboarding_checklist_templates"("slug");

-- CreateIndex
CREATE INDEX "onboarding_checklist_templates_is_default_idx" ON "onboarding_checklist_templates"("is_default");

-- CreateIndex
CREATE INDEX "onboarding_checklist_items_template_id_idx" ON "onboarding_checklist_items"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklist_items_template_id_order_index_key" ON "onboarding_checklist_items"("template_id", "order_index");

-- CreateIndex
CREATE INDEX "employee_checklist_item_statuses_employee_id_idx" ON "employee_checklist_item_statuses"("employee_id");

-- CreateIndex
CREATE INDEX "employee_checklist_item_statuses_item_id_idx" ON "employee_checklist_item_statuses"("item_id");

-- CreateIndex
CREATE INDEX "employee_checklist_item_statuses_status_idx" ON "employee_checklist_item_statuses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_checklist_item_statuses_employee_id_item_id_key" ON "employee_checklist_item_statuses"("employee_id", "item_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_items" ADD CONSTRAINT "onboarding_checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_checklist_item_statuses" ADD CONSTRAINT "employee_checklist_item_statuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_checklist_item_statuses" ADD CONSTRAINT "employee_checklist_item_statuses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "onboarding_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
