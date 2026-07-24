-- Cross-domain audit log. Existing per-module logs stay as
-- the source of truth for their domains — this table is where
-- everything else (member CRUD, settings changes, course /
-- membership / employee lifecycle, certificate issuance) lands
-- so the /admin/activity feed can union everything into one
-- timeline.

CREATE TABLE "audit_logs" (
  "id"            TEXT NOT NULL,
  "actor_id"      TEXT,
  "action"        TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id"   TEXT,
  "summary"       TEXT NOT NULL,
  "metadata"      JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "company_id"    TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_company_id_created_at_idx"
  ON "audit_logs" ("company_id", "created_at" DESC);
CREATE INDEX "audit_logs_actor_id_created_at_idx"
  ON "audit_logs" ("actor_id", "created_at" DESC);
CREATE INDEX "audit_logs_resource_type_resource_id_idx"
  ON "audit_logs" ("resource_type", "resource_id");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
