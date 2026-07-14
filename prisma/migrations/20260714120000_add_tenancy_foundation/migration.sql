-- Phase 1 (White-label roadmap) — tenancy foundation.
--
-- Adds:
--   * Kondense seed Company row (uuid 00000000-0000-0000-0000-000000000001)
--   * CompanyMembership rows for every existing User
--   * super_admin_grants table + User.isSuperAdmin/lastActiveAt columns
--   * Several tables + columns that landed via `db push` during Phase
--     4.4 but were never captured as a proper migration
--     (certificate_issuances, nudges, stat_*, all content-table company_id).
--
-- Feature flag: TENANCY_ENABLED still gates all reads/writes at the app
-- layer (see lib/tenancy/feature-flag.ts). Nothing about this migration
-- changes user-visible behaviour on its own.
--
-- Safe on prod: `ADD COLUMN … NOT NULL DEFAULT` is a metadata-only
-- rewrite in Postgres 11+, so tables of this size lock briefly at most.

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'ADMIN', 'TEAM', 'MEMBER');

-- CreateEnum
CREATE TYPE "SuperAdminRole" AS ENUM ('MASTER', 'SUPPORT', 'AUDITOR');

-- CreateEnum
CREATE TYPE "StatMetricUnit" AS ENUM ('COUNT', 'CURRENCY', 'PERCENT');

-- AlterTable
ALTER TABLE "announcement_audit_logs" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "announcement_comments" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "announcement_reactions" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "announcement_reads" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "course_categories" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "employee_checklist_item_statuses" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "lesson_resources" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "onboarding_checklist_items" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "org_board_revisions" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "org_node_audit_logs" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "org_nodes" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "position_assignments" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "position_details" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_active_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "super_admin_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "SuperAdminRole" NOT NULL DEFAULT 'MASTER',
    "granted_by_id" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "super_admin_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_agency" BOOLEAN NOT NULL DEFAULT false,
    "brand" JSONB,
    "custom_domain" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_issuances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manually_issued_by_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "revoked_reason" TEXT,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "certificate_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nudges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT,
    "message" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_sent_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "nudges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_divisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_label" TEXT,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "stat_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_metrics" (
    "id" TEXT NOT NULL,
    "division_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "StatMetricUnit" NOT NULL DEFAULT 'COUNT',
    "assigned_to_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "target_value" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "stat_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_data_points" (
    "id" TEXT NOT NULL,
    "metric_id" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "recorded_at" DATE NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "company_id" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

    CONSTRAINT "stat_data_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "super_admin_grants_user_id_revoked_at_idx" ON "super_admin_grants"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "super_admin_grants_expires_at_idx" ON "super_admin_grants"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_custom_domain_key" ON "companies"("custom_domain");

-- CreateIndex
CREATE INDEX "companies_deleted_at_idx" ON "companies"("deleted_at");

-- CreateIndex
CREATE INDEX "company_memberships_company_id_role_idx" ON "company_memberships"("company_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_user_id_company_id_key" ON "company_memberships"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_issuances_short_code_key" ON "certificate_issuances"("short_code");

-- CreateIndex
CREATE INDEX "certificate_issuances_user_id_issued_at_idx" ON "certificate_issuances"("user_id", "issued_at");

-- CreateIndex
CREATE INDEX "certificate_issuances_course_id_idx" ON "certificate_issuances"("course_id");

-- CreateIndex
CREATE INDEX "certificate_issuances_revoked_at_idx" ON "certificate_issuances"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_issuances_user_id_module_id_key" ON "certificate_issuances"("user_id", "module_id");

-- CreateIndex
CREATE INDEX "nudges_user_id_dismissed_at_idx" ON "nudges"("user_id", "dismissed_at");

-- CreateIndex
CREATE INDEX "nudges_created_at_idx" ON "nudges"("created_at");

-- CreateIndex
CREATE INDEX "stat_divisions_order_index_idx" ON "stat_divisions"("order_index");

-- CreateIndex
CREATE INDEX "stat_divisions_deleted_at_idx" ON "stat_divisions"("deleted_at");

-- CreateIndex
CREATE INDEX "stat_metrics_division_id_order_index_idx" ON "stat_metrics"("division_id", "order_index");

-- CreateIndex
CREATE INDEX "stat_metrics_assigned_to_id_idx" ON "stat_metrics"("assigned_to_id");

-- CreateIndex
CREATE INDEX "stat_metrics_deleted_at_idx" ON "stat_metrics"("deleted_at");

-- CreateIndex
CREATE INDEX "stat_data_points_metric_id_recorded_at_idx" ON "stat_data_points"("metric_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "stat_data_points_metric_id_recorded_at_key" ON "stat_data_points"("metric_id", "recorded_at");

-- CreateIndex
CREATE INDEX "users_is_super_admin_idx" ON "users"("is_super_admin");

-- AddForeignKey
ALTER TABLE "super_admin_grants" ADD CONSTRAINT "super_admin_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_grants" ADD CONSTRAINT "super_admin_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_grants" ADD CONSTRAINT "super_admin_grants_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issuances" ADD CONSTRAINT "certificate_issuances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issuances" ADD CONSTRAINT "certificate_issuances_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issuances" ADD CONSTRAINT "certificate_issuances_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issuances" ADD CONSTRAINT "certificate_issuances_manually_issued_by_id_fkey" FOREIGN KEY ("manually_issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issuances" ADD CONSTRAINT "certificate_issuances_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_metrics" ADD CONSTRAINT "stat_metrics_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "stat_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_metrics" ADD CONSTRAINT "stat_metrics_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_data_points" ADD CONSTRAINT "stat_data_points_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "stat_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_data_points" ADD CONSTRAINT "stat_data_points_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- Phase 1 data migration — seed the Kondense tenant + backfill memberships.
-- Every content table's company_id column already defaulted to this same
-- UUID via ADD COLUMN above, so existing rows are effectively backfilled
-- as a side effect of the DDL. This block just ensures the Company row
-- itself exists and every legacy User has a matching CompanyMembership.
-- Idempotent: safe to re-run.
-- ==========================================================================

-- Seed the Kondense agency company. Uuid pinned so backfilled company_id
-- values on every content table line up with a real row.
INSERT INTO "companies" ("id", "slug", "name", "is_agency", "created_at", "updated_at")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'kondense',
    'Kondense',
    true,
    NOW(),
    NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Backfill CompanyMembership for every existing user. Role mapping:
--   is_super_admin=true  -> OWNER  (Keanu / Ruel own Kondense)
--   role='ADMIN'         -> ADMIN
--   role='TEAM'          -> TEAM
--   else                 -> MEMBER
-- Uses gen_random_uuid() for the row id (requires pgcrypto, which
-- Supabase enables by default).
INSERT INTO "company_memberships" ("id", "user_id", "company_id", "role", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    u."id",
    '00000000-0000-0000-0000-000000000001',
    (CASE
        WHEN u."is_super_admin" = true THEN 'OWNER'
        WHEN u."role"::text = 'ADMIN' THEN 'ADMIN'
        WHEN u."role"::text = 'TEAM'  THEN 'TEAM'
        ELSE 'MEMBER'
    END)::"CompanyRole",
    NOW(),
    NOW()
FROM "users" u
ON CONFLICT ("user_id", "company_id") DO NOTHING;
