-- Custom roles system (per-company permission layer).
--
-- Replaces the TeamModuleGrant grid with named, reusable role
-- bundles. Admins define roles (e.g. "Setter", "Closer") and
-- assign users to them; effective module access is the union of
-- every role the user holds.
--
-- Sits ON TOP of CompanyMembership.role (unchanged — still the
-- OWNER/ADMIN/TEAM/MEMBER tier). Only the TEAM tier's module
-- gating moves to the new tables.

-- The legacy global User.role enum shares a name with the new
-- per-company Role model. Rename the enum first so both can
-- coexist during the phase-out window.
ALTER TYPE "Role" RENAME TO "UserRole";

-- ============================================
-- New tables
-- ============================================

CREATE TABLE "roles" (
  "id"          TEXT NOT NULL,
  "company_id"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "is_system"   BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_company_id_slug_key"
  ON "roles" ("company_id", "slug");
CREATE INDEX "roles_company_id_idx" ON "roles" ("company_id");

CREATE TABLE "role_permissions" (
  "id"         TEXT NOT NULL,
  "role_id"    TEXT NOT NULL,
  "module_key" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_permissions_role_id_module_key_key"
  ON "role_permissions" ("role_id", "module_key");
CREATE INDEX "role_permissions_company_id_module_key_idx"
  ON "role_permissions" ("company_id", "module_key");
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_role_assignments" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "role_id"        TEXT NOT NULL,
  "company_id"     TEXT NOT NULL,
  "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_by_id" TEXT,
  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_id_key"
  ON "user_role_assignments" ("user_id", "role_id");
CREATE INDEX "user_role_assignments_company_id_user_id_idx"
  ON "user_role_assignments" ("company_id", "user_id");
CREATE INDEX "user_role_assignments_company_id_role_id_idx"
  ON "user_role_assignments" ("company_id", "role_id");
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- Seed the 'Internal Team' system role per company
-- ============================================
-- Every company gets a default role that carries every internal
-- module. New team members can be handed this role and see the
-- same modules as before.

INSERT INTO "roles" (id, company_id, name, slug, description, is_system, updated_at)
SELECT gen_random_uuid()::text,
       c.id,
       'Internal Team',
       'internal-team',
       'Default role for internal staff — grants access to every internal module. Rename or edit as you refine your roles.',
       true,
       CURRENT_TIMESTAMP
FROM "companies" c
WHERE c.deleted_at IS NULL;

-- Grant every default module to the internal-team role. Keys
-- mirror lib/config/team-modules.ts — kept as an inline VALUES
-- list because SQL can't read a TS constant.
INSERT INTO "role_permissions" (id, role_id, module_key, company_id)
SELECT gen_random_uuid()::text, r.id, m.module_key, r.company_id
FROM "roles" r
CROSS JOIN (VALUES
  ('team'),
  ('tasks'),
  ('policies'),
  ('trainings'),
  ('stats'),
  ('org-board'),
  ('onboarding'),
  ('production')
) AS m(module_key)
WHERE r.slug = 'internal-team';

-- ============================================
-- Backfill: preserve exact prior access per user
-- ============================================
-- For every user with unrevoked TeamModuleGrants, create a
-- per-user "Legacy" role carrying their exact keys and assign
-- it. Never lose access on cutover. Admins can consolidate
-- these into shared roles from the UI afterward.

DO $$
DECLARE
  usr RECORD;
  new_role_id TEXT;
BEGIN
  FOR usr IN
    SELECT DISTINCT u.id AS user_id,
                    u.name AS user_name,
                    u.email AS user_email,
                    tmg.company_id AS company_id
    FROM users u
    JOIN team_module_grants tmg ON tmg.user_id = u.id
    WHERE tmg.revoked_at IS NULL
  LOOP
    new_role_id := gen_random_uuid()::text;
    INSERT INTO "roles" (id, company_id, name, slug, description, is_system, updated_at)
    VALUES (
      new_role_id,
      usr.company_id,
      'Legacy — ' || COALESCE(NULLIF(usr.user_name, ''), usr.user_email),
      'legacy-' || usr.user_id,
      'Auto-generated during the roles migration to preserve module access. Safe to consolidate into a shared role once you''ve defined your permanent roles.',
      true,
      CURRENT_TIMESTAMP
    );

    INSERT INTO "role_permissions" (id, role_id, module_key, company_id)
    SELECT gen_random_uuid()::text, new_role_id, tmg.module_key, tmg.company_id
    FROM team_module_grants tmg
    WHERE tmg.user_id = usr.user_id
      AND tmg.company_id = usr.company_id
      AND tmg.revoked_at IS NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO "user_role_assignments" (id, user_id, role_id, company_id)
    VALUES (gen_random_uuid()::text, usr.user_id, new_role_id, usr.company_id);
  END LOOP;
END $$;

-- ============================================
-- Drop the old table
-- ============================================

DROP TABLE "team_module_grants";
