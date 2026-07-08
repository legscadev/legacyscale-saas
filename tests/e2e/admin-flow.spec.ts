import { expect, test } from '@playwright/test'

/**
 * Admin happy-path smoke. Auth comes from auth.setup.ts via the
 * project's storageState — no in-test sign-in.
 *
 * The test creates a "[E2E]"-prefixed course so the write path is
 * exercised; the afterAll archives anything matching the prefix to
 * keep the dev database tidy. Cleanup is best-effort and never
 * fails the suite.
 */

const E2E_PREFIX = '[E2E]'

test.describe('Admin flow', () => {
  test('admin dashboard → courses → members → add-member dialog → create course', async ({
    page,
  }) => {
    // Admin dashboard
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/admin\/dashboard$/)
    await expect(
      page.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible()

    // /admin/courses lists the catalogue
    await page.goto('/admin/courses')
    await expect(
      page.getByRole('heading', { name: 'Courses', level: 1 }),
    ).toBeVisible()

    // Members list smoke
    await page.goto('/admin/members')
    await expect(
      page.getByRole('heading', { name: 'Members', level: 1 }),
    ).toBeVisible()

    // Add Member dialog — Category select should appear for the
    // default Role = Member (verifies the per-member category UI).
    // Scope every lookup to the dialog so the "Category" column
    // header on the underlying table can't shadow the label.
    await page.getByRole('button', { name: /add member/i }).click()
    const dialog = page.getByRole('dialog', { name: /add member/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/^Category$/, { exact: true })).toBeVisible({
      timeout: 5_000,
    })
    await dialog.getByRole('button', { name: /close/i }).first().click()
    await expect(dialog).toBeHidden()

    // Create a throwaway course so the admin-write path is
    // exercised. Title prefixed so the cleanup hook can find it.
    const courseTitle = `${E2E_PREFIX} ${Date.now()} smoke course`
    await page.goto('/admin/courses/new')
    await page.getByLabel(/title/i).first().fill(courseTitle)
    await page.locator('form button[type="submit"]').first().click()
    // Lands on the course edit / builder page
    await expect(page).toHaveURL(/\/admin\/courses\/[^/]+/, { timeout: 15_000 })
  })

  /**
   * Smoke of /admin/certificates. Ensures the page renders + the
   * Issue-certificate dialog opens. Doesn't actually issue a cert —
   * write-side is exercised at the service layer, and issuing here
   * would leave a real row + PDF for the E2E admin.
   */
  test('admin certificates page + issue dialog: member search, course→modules, select-all', async ({
    page,
  }) => {
    await page.goto('/admin/certificates')
    await expect(page).toHaveURL(/\/admin\/certificates$/)
    await expect(
      page.getByRole('heading', { name: 'Certificates', level: 1 }),
    ).toBeVisible()

    // Row-level search is visible.
    await expect(
      page.getByPlaceholder(/search by member.*module.*course/i),
    ).toBeVisible()

    // Open the Issue certificates dialog.
    await page.getByRole('button', { name: /issue certificate/i }).click()
    const dialog = page.getByRole('dialog', { name: /issue certificates/i })
    await expect(dialog).toBeVisible()

    // Member section: search input + always-visible listbox. We
    // dropped the Select dropdown because focusing the search input
    // closed it — a persistent list works reliably instead.
    await expect(
      dialog.getByPlaceholder(/search by name or email/i),
    ).toBeVisible()
    await expect(
      dialog.getByRole('listbox', { name: /members/i }),
    ).toBeVisible()

    // Course still uses a Select combobox (small dropdown, no search).
    await expect(
      dialog.getByRole('combobox', { name: /^course$/i }),
    ).toBeVisible()

    // Nothing selected yet → submit disabled.
    await expect(
      dialog.getByRole('button', { name: /issue certificate/i }),
    ).toBeDisabled()

    // Close without submitting so we don't create real issuances.
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).toBeHidden()
  })

  /**
   * Smoke of the Send-nudge trigger on the member row's actions
   * menu. Verifies the dialog opens with a target-course picker +
   * message field, then cancels without sending. Sending a real
   * nudge would fire a Resend email to a live member address.
   */
  test('admin members page → send nudge dialog opens', async ({ page }) => {
    await page.goto('/admin/members')
    await expect(
      page.getByRole('heading', { name: 'Members', level: 1 }),
    ).toBeVisible()

    // Open the first non-self member's actions menu. The menu
    // trigger has an aria-label the DropdownMenuTrigger stamps on
    // the render'd button — matches "Open actions" or "More".
    const openActions = page
      .getByRole('button', { name: /open actions|more/i })
      .first()
    await expect(openActions).toBeVisible({ timeout: 10_000 })
    await openActions.click()

    // "Send nudge" item is present + clickable for an active member.
    const nudgeItem = page.getByRole('menuitem', { name: /send nudge/i })
    await expect(nudgeItem).toBeVisible({ timeout: 5_000 })
    await nudgeItem.click()

    const dialog = page.getByRole('dialog', { name: /send a nudge/i })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/target course/i).first(),
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /send nudge/i }),
    ).toBeVisible()

    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).toBeHidden()
  })

  /**
   * Statistics tracker smoke. Verifies the revamped layout:
   *   - Group picker + New-group in the header
   *   - Search + Only-mine filter bar
   *   - Date range inputs + preset chips (7d / 30d / 90d / YTD)
   *   - New-group / New-metric dialogs open cleanly
   * Doesn't submit either dialog to keep the DB clean.
   */
  test('admin statistics page + New-group, New-metric, filter + date range', async ({
    page,
  }) => {
    await page.goto('/admin/stats')
    await expect(page).toHaveURL(/\/admin\/stats/)
    await expect(
      page.getByRole('heading', { name: 'Statistics', level: 1 }),
    ).toBeVisible()

    // New group button.
    const newGroup = page.getByRole('button', { name: /^new group$/i })
    await expect(newGroup).toBeVisible()

    // Open the New group dialog + close it.
    await newGroup.click()
    const groupDialog = page.getByRole('dialog', { name: /new group/i })
    await expect(groupDialog).toBeVisible()
    await expect(groupDialog.getByLabel(/^Name$/)).toBeVisible()
    await expect(groupDialog.getByLabel(/short label/i)).toBeVisible()
    await groupDialog.getByRole('button', { name: /cancel/i }).click()
    await expect(groupDialog).toBeHidden()

    // Empty-state vs group-picker branch. If no groups exist yet,
    // only the empty state renders and the filter bar is skipped.
    const groupPicker = page.getByRole('combobox', { name: /^group$/i })
    const emptyState = page.getByText(/no groups yet/i)
    const eitherPresent = await Promise.race([
      groupPicker
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => 'picker'),
      emptyState
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => 'empty'),
    ]).catch(() => null)
    expect(eitherPresent).not.toBeNull()

    if (eitherPresent === 'picker') {
      // Filter bar: search input + Only-mine checkbox.
      await expect(page.getByPlaceholder(/^search/i)).toBeVisible()
      await expect(page.getByLabel(/only mine/i)).toBeVisible()

      // Date range: From/To inputs + preset chips.
      const fromInput = page.getByLabel(/from date/i)
      const toInput = page.getByLabel(/to date/i)
      await expect(fromInput).toBeVisible()
      await expect(toInput).toBeVisible()
      const preset30d = page.getByRole('button', { name: /^30d$/ })
      await expect(preset30d).toBeVisible()

      // 30d preset should fill both date inputs.
      await preset30d.click()
      await expect(fromInput).not.toHaveValue('')
      await expect(toInput).not.toHaveValue('')

      // Clear chip appears after any date is set and empties them.
      await page.getByRole('button', { name: /^clear$/i }).click()
      await expect(fromInput).toHaveValue('')
      await expect(toInput).toHaveValue('')

      // New metric dialog opens cleanly.
      await page.getByRole('button', { name: /^new metric$/i }).click()
      const metricDialog = page.getByRole('dialog', { name: /new metric/i })
      await expect(metricDialog).toBeVisible()
      await expect(metricDialog.getByLabel(/^Name$/)).toBeVisible()
      await expect(
        metricDialog.getByRole('combobox', { name: /^group$/i }),
      ).toBeVisible()
      await expect(
        metricDialog.getByRole('combobox', { name: /^unit$/i }),
      ).toBeVisible()
      await metricDialog.getByRole('button', { name: /cancel/i }).click()
      await expect(metricDialog).toBeHidden()
    }
  })

  /**
   * Role-swap top-bar button. Admin should see "View as member" on
   * admin routes → clicking it lands on the member dashboard, where
   * the mirror "Back to admin" button appears.
   */
  test('admin ↔ member view swap in the top bar', async ({ page }) => {
    // The swap button is a <Button render={<Link />}>: renders as an
    // <a> tag but Base UI stamps role="button" explicitly, so
    // getByRole must ask for 'button'.
    await page.goto('/admin/dashboard')
    const toMember = page.getByRole('button', { name: /view as member/i })
    await expect(toMember).toBeVisible({ timeout: 5_000 })
    await toMember.click()
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 })

    const backToAdmin = page.getByRole('button', { name: /back to admin/i })
    await expect(backToAdmin).toBeVisible({ timeout: 5_000 })
    await backToAdmin.click()
    await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 10_000 })
  })

  /**
   * Best-effort cleanup. Opens a fresh admin context (auth from
   * storageState) and archives every course whose title starts
   * with the E2E prefix. Failures never fail the suite — orphan
   * rows are visible by name and easy to bulk-delete manually.
   *
   * Bounded by an outer soft-cap so slow-to-hydrate dev servers
   * can't blow through Playwright's 30s hook budget. If we run
   * out of time we log + bail; leftover courses are still
   * identifiable by their [E2E] prefix.
   */
  const CLEANUP_SOFT_CAP_MS = 20_000

  test.afterAll(async ({ browser }) => {
    await Promise.race([
      runCleanup(browser),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn(
            `[E2E cleanup] soft-cap of ${CLEANUP_SOFT_CAP_MS}ms hit — bailing`,
          )
          resolve()
        }, CLEANUP_SOFT_CAP_MS),
      ),
    ])
  })

  async function runCleanup(
    browser: import('@playwright/test').Browser,
  ): Promise<void> {
    const context = await browser.newContext({
      storageState: '.auth/admin.json',
    })
    const page = await context.newPage()
    // Tight internal timeouts so a stalled navigation surfaces fast
    // instead of eating the whole soft cap.
    page.setDefaultTimeout(6_000)
    page.setDefaultNavigationTimeout(6_000)

    try {
      await page.goto('/admin/courses', { waitUntil: 'domcontentloaded' })
      const initialCount = await page
        .locator('a', { hasText: new RegExp(`^\\${E2E_PREFIX}`) })
        .count()
      // Fast path: nothing to clean, don't do further navigation
      // and don't burn the timeout on empty work.
      if (initialCount === 0) return

      const targets = await page
        .locator('a', { hasText: new RegExp(`^\\${E2E_PREFIX}`) })
        .all()
      for (const link of targets) {
        try {
          await link.click()
          await page.waitForURL(/\/admin\/courses\/[^/]+/, { timeout: 4_000 })
          const more = page
            .getByRole('button', { name: /open actions|more/i })
            .first()
          if ((await more.count()) > 0) {
            await more.click()
            const archive = page
              .getByRole('menuitem', { name: /archive|delete/i })
              .first()
            if ((await archive.count()) > 0) {
              await archive.click()
              const confirm = page
                .getByRole('button', { name: /archive|delete|confirm/i })
                .first()
              if ((await confirm.count()) > 0) await confirm.click()
            }
          }
          await page.goto('/admin/courses', { waitUntil: 'domcontentloaded' })
        } catch (err) {
          console.warn('[E2E cleanup] could not delete a course:', err)
        }
      }
    } catch (err) {
      console.warn('[E2E cleanup] skipped:', err)
    } finally {
      await context.close()
    }
  }
})
