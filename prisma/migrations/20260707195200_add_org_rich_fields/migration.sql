-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'ADVISORY');

-- AlterTable
ALTER TABLE "org_nodes"
  ADD COLUMN "function_text" TEXT,
  ADD COLUMN "responsibilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "position_details" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "code" TEXT,
    "level" INTEGER,
    "headcount_min" INTEGER,
    "headcount_max" INTEGER,
    "employment_type" "EmploymentType",
    "kpis" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_assignments" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date_assigned" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "employment_type" "EmploymentType",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "position_details_node_id_key" ON "position_details"("node_id");

-- CreateIndex
CREATE INDEX "position_details_code_idx" ON "position_details"("code");

-- CreateIndex
CREATE INDEX "position_assignments_node_id_ended_at_idx" ON "position_assignments"("node_id", "ended_at");

-- CreateIndex
CREATE INDEX "position_assignments_employee_id_ended_at_idx" ON "position_assignments"("employee_id", "ended_at");

-- AddForeignKey
ALTER TABLE "position_details" ADD CONSTRAINT "position_details_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "org_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "org_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
