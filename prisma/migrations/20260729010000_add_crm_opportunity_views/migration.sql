-- CRM — saved filter views on the Opportunities board (Phase F).
-- Powers HighLevel-style "smart list" sub-tabs. Filter shape is
-- stored as JSON so adding a new facet doesn't need a migration.

CREATE TABLE "crm_opportunity_views" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "owner_id"    TEXT,
  "filter_json" JSONB NOT NULL,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "company_id"  TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',

  CONSTRAINT "crm_opportunity_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_opportunity_views_company_id_owner_id_order_index_idx"
  ON "crm_opportunity_views" ("company_id", "owner_id", "order_index");

ALTER TABLE "crm_opportunity_views" ADD CONSTRAINT "crm_opportunity_views_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
