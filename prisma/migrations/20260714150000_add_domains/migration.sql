-- Phase 3 (White-label roadmap) — Task 10: Domain table.
--
-- A tenant can be reached at any number of hostnames — one or more
-- managed subdomains (<slug>.kondense.ai, wildcard-cert-covered),
-- plus optional custom domains verified via TXT + Vercel-issued SSL.
--
-- Idempotent guards on every statement so this replays cleanly on a
-- prod DB whose schema was set up via db push at some point in the
-- past (same drift pattern I hit in Phase 1.1).

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DomainKind" AS ENUM ('MANAGED_SUBDOMAIN', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "domains" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" "DomainKind" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "ssl_issued_at" TIMESTAMP(3),
    "vercel_domain_id" TEXT,
    "verification_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "domains_hostname_key" ON "domains"("hostname");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "domains_company_id_idx" ON "domains"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "domains_verified_at_idx" ON "domains"("verified_at");

-- AddForeignKey — DO block since Postgres has no IF NOT EXISTS on constraints.
DO $$ BEGIN
    ALTER TABLE "domains"
        ADD CONSTRAINT "domains_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
