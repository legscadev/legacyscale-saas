-- CreateEnum
CREATE TYPE "OrgAuditAction" AS ENUM ('NODE_CREATED', 'NODE_UPDATED', 'NODE_MOVED', 'NODE_DELETED', 'ASSIGNMENT_ADDED', 'ASSIGNMENT_ENDED');

-- CreateTable
CREATE TABLE "org_node_audit_logs" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "node_id" TEXT,
    "actor_user_id" TEXT,
    "action" "OrgAuditAction" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_node_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_node_audit_logs_revision_id_created_at_idx" ON "org_node_audit_logs"("revision_id", "created_at");

-- CreateIndex
CREATE INDEX "org_node_audit_logs_node_id_created_at_idx" ON "org_node_audit_logs"("node_id", "created_at");

-- AddForeignKey
ALTER TABLE "org_node_audit_logs" ADD CONSTRAINT "org_node_audit_logs_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "org_board_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_node_audit_logs" ADD CONSTRAINT "org_node_audit_logs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "org_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_node_audit_logs" ADD CONSTRAINT "org_node_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
