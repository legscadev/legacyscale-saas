-- CreateEnum
CREATE TYPE "OrgNodeKind" AS ENUM ('CROWN', 'DIVISION', 'DEPARTMENT', 'SECTION', 'UNIT', 'POSITION');

-- CreateTable
CREATE TABLE "org_board_revisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "org_board_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_nodes" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" "OrgNodeKind" NOT NULL,
    "label" TEXT NOT NULL,
    "dept_number" INTEGER,
    "position_title" TEXT,
    "employee_id" TEXT,
    "free_text_holder" TEXT,
    "vfp" TEXT,
    "color" TEXT,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_board_revisions_is_current_idx" ON "org_board_revisions"("is_current");

-- CreateIndex
CREATE INDEX "org_nodes_revision_id_idx" ON "org_nodes"("revision_id");

-- CreateIndex
CREATE INDEX "org_nodes_parent_id_idx" ON "org_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "org_nodes_kind_idx" ON "org_nodes"("kind");

-- CreateIndex
CREATE INDEX "org_nodes_employee_id_idx" ON "org_nodes"("employee_id");

-- AddForeignKey
ALTER TABLE "org_board_revisions" ADD CONSTRAINT "org_board_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "org_board_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
