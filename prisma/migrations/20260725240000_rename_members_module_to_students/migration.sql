-- The Community-section "Members" module was renamed to "Students"
-- (route: /admin/members → /admin/students; module key: members →
-- students). Update every existing role_permissions row so no user
-- loses access to the page after the module-key catalog change.
--
-- ON CONFLICT DO NOTHING covers the (very unlikely) case where a
-- role already holds both keys due to a prior half-migration.

UPDATE "role_permissions"
SET "module_key" = 'students'
WHERE "module_key" = 'members'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" existing
    WHERE existing.role_id = "role_permissions".role_id
      AND existing.module_key = 'students'
  );

-- Drop any orphan 'members' rows that couldn't be renamed (already
-- had a 'students' row on the same role).
DELETE FROM "role_permissions" WHERE "module_key" = 'members';
