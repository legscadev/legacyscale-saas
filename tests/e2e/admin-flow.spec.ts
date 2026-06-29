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
