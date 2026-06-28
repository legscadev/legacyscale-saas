import { expect, test } from '@playwright/test'

/**
 * Member happy-path smoke. Auth comes from auth.setup.ts via
 * the project's storageState — no in-test sign-in, which keeps
 * us under the auth rate limit on cross-browser runs.
 */
test.describe('Member flow', () => {
  test('dashboard → courses → course detail → announcements → profile', async ({
    page,
  }) => {
    // Member dashboard
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible()

    // Catalog
    await page.goto('/courses')
    await expect(
      page.getByRole('heading', { name: 'My Courses', level: 1 }),
    ).toBeVisible()

    // Open the first available course
    const firstCourse = page.locator('a[href^="/courses/"]').first()
    await expect(firstCourse).toBeVisible({ timeout: 10_000 })
    await firstCourse.click()
    await expect(page).toHaveURL(/\/courses\/[^/]+$/)
    await expect(
      page.getByRole('button', {
        name: /(Start course|Continue learning|Replay course)/i,
      }),
    ).toBeVisible()

    // Announcements
    await page.goto('/announcements')
    await expect(
      page.getByRole('heading', { name: 'Announcements', level: 1 }),
    ).toBeVisible()

    // Profile
    await page.goto('/profile')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})
