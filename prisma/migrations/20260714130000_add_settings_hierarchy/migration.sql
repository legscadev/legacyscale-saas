-- Phase 1 (White-label roadmap) — Task 4: hierarchical Setting table.
--
-- Adds:
--   * SettingScope enum (PLATFORM, COMPANY, USER)
--   * `settings` table keyed by (scope, scope_id, key)
--   * DML: backfills Discord-webhook rows from the legacy
--     `app_settings` table so lookups keep resolving after
--     `lib/services/app-setting-service.ts` retargets to the new
--     hierarchy.
--
-- The old `app_settings` table stays intact for the transition —
-- can be dropped in Phase 2 once every reader has been verified
-- against the new table.

-- CreateEnum
CREATE TYPE "SettingScope" AS ENUM ('PLATFORM', 'COMPANY', 'USER');

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "scope" "SettingScope" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settings_scope_scope_id_idx" ON "settings"("scope", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_scope_scope_id_key_key" ON "settings"("scope", "scope_id", "key");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================================================
-- Backfill: copy the two admin-editable Discord webhook rows from
-- app_settings into the new hierarchy as PLATFORM-scoped rows.
-- Existing `app_settings` values are left in place so the transition
-- is reversible while the app-setting service dual-reads.
-- Idempotent: ON CONFLICT DO NOTHING makes re-runs safe.
-- ==========================================================================
INSERT INTO "settings" ("id", "scope", "scope_id", "key", "value", "updated_at", "updated_by_id")
SELECT
    gen_random_uuid()::text,
    'PLATFORM'::"SettingScope",
    '00000000-0000-0000-0000-000000000000',
    a."key",
    to_jsonb(a."value"),
    COALESCE(a."updated_at", NOW()),
    a."updated_by_id"
FROM "app_settings" a
WHERE a."key" IN ('discord.webhook_url', 'discord.achievements_webhook_url')
ON CONFLICT ("scope", "scope_id", "key") DO NOTHING;
