-- Drop the multi-template abstraction. Items now live in a single
-- flat table and every Employee is implicitly attached to that list.

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_template_id_fkey";

-- DropForeignKey
ALTER TABLE "onboarding_checklist_items" DROP CONSTRAINT "onboarding_checklist_items_template_id_fkey";

-- DropIndex
DROP INDEX "onboarding_checklist_items_template_id_order_index_key";

-- DropIndex
DROP INDEX "onboarding_checklist_items_template_id_idx";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "template_id";

-- AlterTable
ALTER TABLE "onboarding_checklist_items" DROP COLUMN "template_id";

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_checklist_items_order_index_key" ON "onboarding_checklist_items"("order_index");

-- DropTable
DROP TABLE "onboarding_checklist_templates";
