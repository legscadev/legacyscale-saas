import { expect, type Page } from '@playwright/test'

/**
 * Pull credentials from env. We intentionally fail loud — running
 * these specs without the vars is almost certainly a misconfiguration
 * worth catching at suite start.
 */
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Set it in .env.local before running the E2E suite.`,
    )
  }
  return v
}

export const ADMIN_EMAIL = requireEnv('E2E_ADMIN_EMAIL')
export const ADMIN_PASSWORD = requireEnv('E2E_ADMIN_PASSWORD')
export const MEMBER_EMAIL = requireEnv('E2E_MEMBER_EMAIL')
export const MEMBER_PASSWORD = requireEnv('E2E_MEMBER_PASSWORD')

/**
 * Drive the login form. Submitting auth via UI rather than a session
 * cookie injection so the rate limit + cookie flow is part of every
 * E2E run.
 */
export async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Either /dashboard (member) or /admin/dashboard (admin) — both
  // resolve to "Dashboard" h1 in the shell.
  try {
    await expect(page).toHaveURL(/\/(admin\/)?dashboard$/, { timeout: 15_000 })
  } catch (err) {
    // Surface any inline error (rate limit, bad creds, etc.) so a
    // failed sign-in produces a clear message instead of a generic
    // "still on /login" trace.
    const alert = page.getByRole('alert').first()
    if (await alert.count()) {
      const message = await alert.textContent()
      throw new Error(`Sign-in failed: ${message?.trim() || '(empty alert)'}`)
    }
    throw err
  }
}

/**
 * Sign out via the sidebar user menu. Lands back on /login.
 */
export async function signOut(page: Page): Promise<void> {
  // The user-menu trigger label varies (admin shows full name, member
  // shows initials+name). Use a partial match on the visible email.
  await page.getByRole('button', { name: /@/ }).first().click()
  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 })
}
