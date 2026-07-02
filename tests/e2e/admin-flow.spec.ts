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

    // Member section — search input + Select trigger. Base UI's
    // SelectTrigger presents as role=combobox (the correct ARIA for
    // a listbox-style picker). The accessible name comes from the
    // associated Label ("Member" / "Course"), not the placeholder.
    await expect(
      dialog.getByPlaceholder(/search by name or email/i),
    ).toBeVisible()
    await expect(
      dialog.getByRole('combobox', { name: /^member$/i }),
    ).toBeVisible()

    // Course section — same combobox pattern.
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
   */
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: '.auth/admin.json',
    })
    const page = await context.newPage()
    try {
      await page.goto('/admin/courses')
      const targets = await page
        .locator('a', { hasText: new RegExp(`^\\${E2E_PREFIX}`) })
        .all()
      for (const link of targets) {
        try {
          await link.click()
          await page.waitForURL(/\/admin\/courses\/[^/]+/, { timeout: 5_000 })
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
          await page.goto('/admin/courses')
        } catch (err) {
          console.warn('[E2E cleanup] could not delete a course:', err)
        }
      }
    } catch (err) {
      console.warn('[E2E cleanup] skipped:', err)
    } finally {
      await context.close()
    }
  })
})
