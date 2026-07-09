# Multi-Tenancy Architecture

Working reference for the GHL-style white-label refactor. Updated as
phases land.

## Decisions locked

| Decision | Choice | Why |
|---|---|---|
| User model | **Global** — one login per person, memberships in many companies | Standard SaaS pattern; matches how Keanu will actually work. Avoids duplicate-email drift. |
| Super-admin | **`User.isSuperAdmin` boolean** on the global user row | Decouples "master key" from any specific company; future-proof if we ever kill the seed Kondense company. |
| Branch strategy | **Long-lived `feat/multi-tenancy`** merged into develop only when phases go behind the flag | Keeps develop shippable and RLS half-writes out of routine deploys. |

## Core model

```
User (global)
  id
  email          -- unique across the whole app
  isSuperAdmin   -- boolean; Keanu = true

Company (tenant)
  id
  slug           -- URL-safe, unique
  name           -- display
  isAgency       -- true only for the Kondense parent row (optional flag; not
                    load-bearing for auth)
  brand          -- Json { logo, favicon, primary, accent, productName, emailFromName }
  customDomain   -- nullable; verified via Vercel
  createdAt / updatedAt / deletedAt

CompanyMembership (join)
  id
  userId
  companyId
  role           -- OWNER | ADMIN | TEAM | MEMBER
  createdAt
  UNIQUE (userId, companyId)
```

Roles are scoped to the company; a single user can be `OWNER` in
Company A, `MEMBER` in Company B, and `ADMIN` in Company C.

`User.role` (the current top-level role column) becomes deprecated —
we keep it during migration so nothing else breaks, then drop it in
Phase 2. Effective role for any surface is the current company's
membership.

## Active tenant context

- Persisted in a signed cookie (`active_company_id`)
- Server helper `getActiveCompany()` reads the cookie, verifies the
  caller has a membership (or is `isSuperAdmin`), returns `Company`
- Every service call takes `companyId` explicitly — no ambient
  global. Callers pull it from `getActiveCompany()` at the request
  boundary, not deep in the call stack.
- Storage bucket paths get a company prefix so signed-URL access
  can't be moved sideways: `course-thumbnails/<companyId>/…`

## RLS strategy

Postgres session variable set per request by the Supabase client:
`SET LOCAL app.company_id = '<uuid>'`.

Every tenant-scoped table's SELECT/INSERT/UPDATE/DELETE policies
carry:

```sql
USING (company_id = current_setting('app.company_id', true)::uuid)
```

Super-admin bypass runs through a separate policy:

```sql
USING (
  current_setting('app.company_id', true)::uuid IS NULL
  AND EXISTS (SELECT 1 FROM users u
              WHERE u.id = public.current_user_id()
                AND u.is_super_admin = true)
)
```

Super-admin "enter company" flips the session variable to the target
company's id — same query path as everyone else, no ambient-bypass
holes.

## Tables to add `company_id` to (Phase 1 migration)

| Table | Notes |
|---|---|
| `courses` | includes trainings — same table, different audience |
| `course_categories` (pivot) | inherits via `categories.company_id` + `courses.company_id`; consistent both sides |
| `categories` | company-scoped |
| `modules`, `chapters`, `lessons`, `lesson_resources` | inherit via `courses.company_id`; explicit column for RLS speed |
| `quiz_questions`, `quiz_attempts` | inherit via `lessons.company_id` |
| `enrollments`, `lesson_progress`, `notes` | via `courses.company_id` |
| `certificate_issuances` | via `courses.company_id`; storage bucket paths also company-prefixed |
| `announcements`, `announcement_reads`, `announcement_comments`, `announcement_reactions`, `announcement_audit_logs` | company-scoped |
| `invites` | company-scoped so a Stephen-invite lands in Stephen's company |
| `login_events` | per-user global data; no company_id needed (analytics stay attributed to the user) |
| `nudges` | company-scoped |
| `stat_divisions`, `stat_metrics`, `stat_data_points` | company-scoped |
| `org_board_revisions`, `org_nodes`, `org_node_audit_logs`, `org_assignments` | company-scoped |
| `employees` | company-scoped (each apartment maintains its own staff roster) |
| `onboarding_checklist_items`, `onboarding_assignments` | company-scoped |
| `app_settings` | company-scoped |
| `rate_limits` | global (rate limiting is per-IP × action, not per-tenant) |
| `users` | GLOBAL — no company_id (membership is separate) |

Rate limits + login events + users stay global. Everything else gets
scoped.

## Migration path

1. **Additive schema** — add `Company` + `CompanyMembership` + nullable
   `company_id` on every table above.
2. **Backfill** — create seed company `Kondense` (uuid stable in
   docs), backfill every existing row's `company_id` to that uuid,
   create a `CompanyMembership` row for every existing user with
   their current top-level role.
3. **NOT NULL** — after backfill verifies 0 nulls per table, flip
   each column to NOT NULL in a follow-up migration.
4. **Storage** — background job moves existing thumbnails / covers /
   certificate PDFs into `<companyId>/…` prefix. Old paths kept as a
   fallback for one deploy so signed URLs already issued don't break.
5. **RLS switchover** — session variable set on every request; RLS
   policies rewritten. Cross-tenant E2E must be green before this
   gets merged past the feature flag.
6. **Retire `User.role`** — after every membership row is verified,
   drop the column and any remaining references. Deferred to Phase
   7 rollout so we don't fight two abstractions during the middle
   phases.

## Feature-flag posture

- `TENANCY_ENABLED=false` (default) — app renders exactly as today.
  No company switcher, no super-admin surface, no branding overrides.
- `TENANCY_ENABLED=true` on develop only, once Phase 1 lands.
- Prod stays false until Phase 7. All phases prior are safe to merge
  behind the flag.

## Testing posture

- New E2E project `tenancy-cross-tenant`: signs in as Tenant A user,
  hits Tenant B URLs / actions, expects 404 or 403 on every module
  we've built.
- Skipped while `TENANCY_ENABLED=false`.
- Each phase adds its coverage before merging back into develop.

## Open questions (parking lot)

- Do super-admin actions inside a tenant show up in that tenant's
  audit logs? (Recommend yes, with actor `Super Admin: Keanu`.)
- Cross-company analytics for Keanu — deferred to a Phase 8.
- Can a user be a member of multiple companies simultaneously in one
  browser session? Cookie holds one active company at a time; switcher
  writes a new cookie. Sub-tabs → same cookie.
- Are certificates portable across tenants? Answer: no. Same course
  cloned into Tenant B is a new course; certificates issued in
  Tenant A stay in Tenant A.
