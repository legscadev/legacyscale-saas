-- Grant the new 'roles' module permission to the seeded 'admin'
-- and 'internal-team' system roles so existing users who held
-- those roles keep access to /admin/roles after the moduleKey gate
-- flips from requireAdmin to requireTeamModuleAccess('roles').
--
-- 'roles' is a high-trust permission (holders can grant any other
-- module to any user) — new custom roles must opt in explicitly
-- from the roles matrix.

INSERT INTO "role_permissions" (id, role_id, module_key, company_id)
SELECT gen_random_uuid()::text, r.id, 'roles', r.company_id
FROM "roles" r
WHERE r.slug IN ('admin', 'internal-team')
ON CONFLICT DO NOTHING;
