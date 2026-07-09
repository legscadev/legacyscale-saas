import { expect, test } from '@playwright/test'

/**
 * Cross-tenant isolation harness.
 *
 * Signs in as an admin inside Tenant A and pokes at URLs / actions
 * owned by Tenant B. A green run is the guarantee that the query
 * filters (Prisma tenancy extension + member scope helpers) and,
 * once Phase 7 flips the Prisma role off BYPASSRLS, the RLS
 * policies keep the walls up.
 *
 * The suite auto-skips unless every prerequisite is met:
 *   - TENANCY_ENABLED=1
 *   - .auth/tenant-a-admin.json + .auth/tenant-b-admin.json exist
 *     (produced by auth.setup.ts when the credentials are set)
 *   - Per-test identifier env vars (E2E_TENANT_B_COURSE_SLUG, …)
 *     are set. Missing vars skip individual probes so a partially
 *     seeded environment still runs the tests it can.
 *
 * Companion seed script: scripts/seed-tenant-b.ts stands up a
 * second Company + owner user + a small course/stat/cert set.
 */

const TENANCY_ENABLED = process.env.TENANCY_ENABLED === '1'

function envOrSkip(name: string): string | null {
  const v = process.env[name]
  return v && v.length > 0 ? v : null
}

test.describe('Cross-tenant isolation', () => {
  test.skip(
    !TENANCY_ENABLED,
    'Multi-tenancy is disabled on this deploy (TENANCY_ENABLED != 1)',
  )

  test('Tenant A cannot open a Tenant B course by slug', async ({ page }) => {
    const slug = envOrSkip('E2E_TENANT_B_COURSE_SLUG')
    test.skip(!slug, 'Set E2E_TENANT_B_COURSE_SLUG to run this probe')

    // Signed-in Tenant-A admin walks straight at Tenant B's course
    // URL. Expected: 404 (RLS + query filter hide it) OR a redirect
    // to /admin/courses (list falls back when the deep-link 404s).
    const response = await page.goto(`/admin/courses/${slug}`)
    expect(response?.status()).toBeGreaterThanOrEqual(400)
    await expect(page).not.toHaveURL(new RegExp(`/admin/courses/${slug}$`))
  })

  test('Tenant A cannot list Tenant B members', async ({ page }) => {
    const foreignEmail = envOrSkip('E2E_TENANT_B_MEMBER_EMAIL')
    test.skip(
      !foreignEmail,
      'Set E2E_TENANT_B_MEMBER_EMAIL to run this probe',
    )

    // The members table must NOT surface the Tenant-B member — the
    // memberTenantScope() filter in member-service is the enforcer.
    await page.goto('/admin/members')
    await expect(page.getByText(foreignEmail!, { exact: false })).toHaveCount(0)
  })

  test('Tenant A cannot view Tenant B stat metrics', async ({ page }) => {
    const metricId = envOrSkip('E2E_TENANT_B_STAT_METRIC_ID')
    test.skip(!metricId, 'Set E2E_TENANT_B_STAT_METRIC_ID to run this probe')

    const response = await page.goto(`/admin/stats/metrics/${metricId}`)
    expect(response?.status()).toBeGreaterThanOrEqual(400)
    await expect(page).not.toHaveURL(new RegExp(`/${metricId}$`))
  })

  test('Tenant A cannot download a Tenant B certificate', async ({ page }) => {
    const certId = envOrSkip('E2E_TENANT_B_CERT_ISSUANCE_ID')
    test.skip(
      !certId,
      'Set E2E_TENANT_B_CERT_ISSUANCE_ID to run this probe',
    )

    // The download route resolves the issuance by (userId, issuanceId)
    // for members and by requireAdmin() + companyId for admins. The
    // cross-tenant admin must get a 4xx.
    const response = await page.request.get(
      `/api/certificates/${certId}/download`,
    )
    expect([401, 403, 404]).toContain(response.status())
  })

  test('Tenant A cannot fetch Tenant B org board revisions', async ({
    page,
  }) => {
    const revisionId = envOrSkip('E2E_TENANT_B_ORG_REVISION_ID')
    test.skip(
      !revisionId,
      'Set E2E_TENANT_B_ORG_REVISION_ID to run this probe',
    )

    const response = await page.goto(`/admin/org-board/${revisionId}`)
    expect(response?.status()).toBeGreaterThanOrEqual(400)
  })

  test('Tenant A cannot open a Tenant B employee record', async ({ page }) => {
    const employeeId = envOrSkip('E2E_TENANT_B_EMPLOYEE_ID')
    test.skip(!employeeId, 'Set E2E_TENANT_B_EMPLOYEE_ID to run this probe')

    const response = await page.goto(`/admin/employees/${employeeId}`)
    expect(response?.status()).toBeGreaterThanOrEqual(400)
  })
})

test.describe('Super-admin cross-tenant bypass', () => {
  test.skip(
    !TENANCY_ENABLED,
    'Multi-tenancy is disabled on this deploy (TENANCY_ENABLED != 1)',
  )

  test('Super-admin can enter Tenant B and see its courses', async ({
    page,
  }) => {
    const tenantBId = envOrSkip('E2E_TENANT_B_COMPANY_ID')
    const slug = envOrSkip('E2E_TENANT_B_COURSE_SLUG')
    test.skip(
      !tenantBId || !slug,
      'Set E2E_TENANT_B_COMPANY_ID and E2E_TENANT_B_COURSE_SLUG to run',
    )

    // Set the active-company cookie to Tenant B — mirrors what the
    // CompanySwitcher does. Only super-admins have the membership
    // check bypass in setActiveCompanyCookie's server-side handler.
    await page.context().addCookies([
      {
        name: 'active_company_id',
        value: tenantBId!,
        domain: new URL(page.url()).hostname,
        path: '/',
      },
    ])

    // Course that was 404 for a regular Tenant-A admin should render
    // for the super-admin now that they've switched into Tenant B.
    const response = await page.goto(`/admin/courses/${slug}`)
    expect(response?.status()).toBeLessThan(400)
  })
})
