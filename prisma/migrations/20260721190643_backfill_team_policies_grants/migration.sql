-- Backfill: every existing TEAM user in every tenant they belong
-- to gets the 'policies' module grant. Prevents a regression where
-- TEAM staff who could visit /policies yesterday suddenly can't
-- once Phase 2.1 flips the auth gate from requireTeamOrAdmin to
-- requireTeamModuleAccess('policies').
--
-- Idempotent — NOT EXISTS guard means re-running is safe (Prisma
-- won't but manual reruns during dev are common).

INSERT INTO team_module_grants (id, user_id, module_key, granted_at, company_id)
SELECT
  gen_random_uuid()::text,
  m.user_id,
  'policies',
  NOW(),
  m.company_id
FROM company_memberships m
JOIN users u ON u.id = m.user_id
WHERE m.role = 'TEAM'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM team_module_grants g
    WHERE g.user_id = m.user_id
      AND g.module_key = 'policies'
      AND g.company_id = m.company_id
      AND g.revoked_at IS NULL
  );
