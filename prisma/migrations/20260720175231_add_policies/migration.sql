-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "policy_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "policy_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "category_id" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_revisions" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by_id" TEXT,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "policy_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_attachments" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "policy_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_activity_logs" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "from_value" JSONB,
    "to_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "policy_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_categories_company_id_name_key" ON "policy_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "policies_company_id_status_idx" ON "policies"("company_id", "status");

-- CreateIndex
CREATE INDEX "policies_company_id_category_id_idx" ON "policies"("company_id", "category_id");

-- CreateIndex
CREATE INDEX "policies_company_id_published_at_idx" ON "policies"("company_id", "published_at");

-- CreateIndex
CREATE INDEX "policies_company_id_archived_at_idx" ON "policies"("company_id", "archived_at");

-- CreateIndex
CREATE INDEX "policies_company_id_deleted_at_idx" ON "policies"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "policy_revisions_company_id_policy_id_published_at_idx" ON "policy_revisions"("company_id", "policy_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_revisions_policy_id_revision_key" ON "policy_revisions"("policy_id", "revision");

-- CreateIndex
CREATE INDEX "policy_attachments_company_id_policy_id_created_at_idx" ON "policy_attachments"("company_id", "policy_id", "created_at");

-- CreateIndex
CREATE INDEX "policy_activity_logs_company_id_policy_id_created_at_idx" ON "policy_activity_logs"("company_id", "policy_id", "created_at");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "policy_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_revisions" ADD CONSTRAINT "policy_revisions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_revisions" ADD CONSTRAINT "policy_revisions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_attachments" ADD CONSTRAINT "policy_attachments_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_attachments" ADD CONSTRAINT "policy_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_activity_logs" ADD CONSTRAINT "policy_activity_logs_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_activity_logs" ADD CONSTRAINT "policy_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
