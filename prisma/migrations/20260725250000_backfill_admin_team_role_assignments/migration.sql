-- Backfill role assignments for every ADMIN + TEAM tier user who
-- currently holds no custom-role assignment in their active
-- company. Prior versions of the Add/Edit dialog silently swallowed
-- the assignment leg for ADMIN targets (setUserRoles rejected them),
-- so admins created before that fix show "None" in the Roles column.
--
-- Policy:
--   ADMIN tier user (per CompanyMembership.role) → seeded 'admin' role
--   TEAM  tier user                               → seeded 'internal-team' role
--   MEMBER tier                                   → skipped (students don't hold roles)
--
-- Only inserts when the user has zero assignments in that company —
-- never overrides an existing assignment.

INSERT INTO "user_role_assignments" (id, user_id, role_id, company_id)
SELECT
  gen_random_uuid()::text,
  cm.user_id,
  r.id,
  cm.company_id
FROM "company_memberships" cm
JOIN "users" u ON u.id = cm.user_id AND u.deleted_at IS NULL
JOIN "roles" r
  ON r.company_id = cm.company_id
 AND r.slug = CASE
   WHEN cm.role::text IN ('OWNER', 'ADMIN') THEN 'admin'
   WHEN cm.role::text = 'TEAM' THEN 'internal-team'
   ELSE NULL
 END
WHERE cm.role::text IN ('OWNER', 'ADMIN', 'TEAM')
  AND NOT EXISTS (
    SELECT 1 FROM "user_role_assignments" existing
    WHERE existing.user_id = cm.user_id
      AND existing.company_id = cm.company_id
  );
