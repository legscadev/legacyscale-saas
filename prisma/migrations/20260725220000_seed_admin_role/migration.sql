-- Seed a non-deletable "Admin" system role per company with every
-- module enabled. Complements the existing "Internal Team" system
-- role (which carries the default TEAM permission set) — Admin is
-- the "grants everything" convenience role.
--
-- Also extends the Internal Team role's permissions to cover the
-- newly-added Learning / Community / System modules so that
-- everyone previously assigned to Internal Team keeps the same
-- effective access shape (all internal + all admin surfaces).

-- 1. Insert the Admin role per company (skip if it already exists).
INSERT INTO "roles" (id, company_id, name, slug, description, is_system, updated_at)
SELECT gen_random_uuid()::text,
       c.id,
       'Admin',
       'admin',
       'Full access — grants every module. Non-deletable; safe to keep for owners.',
       true,
       CURRENT_TIMESTAMP
FROM "companies" c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "roles" r WHERE r.company_id = c.id AND r.slug = 'admin'
  );

-- 2. Grant every module to the Admin role.
INSERT INTO "role_permissions" (id, role_id, module_key, company_id)
SELECT gen_random_uuid()::text, r.id, m.module_key, r.company_id
FROM "roles" r
CROSS JOIN (VALUES
  ('courses'),
  ('membership'),
  ('certificates'),
  ('progress'),
  ('members'),
  ('announcements'),
  ('team'),
  ('tasks'),
  ('policies'),
  ('trainings'),
  ('stats'),
  ('org-board'),
  ('onboarding'),
  ('production'),
  ('activity'),
  ('settings')
) AS m(module_key)
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- 3. Backfill the newly-added modules onto the existing Internal
-- Team role so existing members don't experience a regression.
INSERT INTO "role_permissions" (id, role_id, module_key, company_id)
SELECT gen_random_uuid()::text, r.id, m.module_key, r.company_id
FROM "roles" r
CROSS JOIN (VALUES
  ('courses'),
  ('membership'),
  ('certificates'),
  ('progress'),
  ('members'),
  ('announcements'),
  ('activity'),
  ('settings')
) AS m(module_key)
WHERE r.slug = 'internal-team'
ON CONFLICT DO NOTHING;
