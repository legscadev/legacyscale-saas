import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the Sprint 7 E2E suite. Targets the deployed
 * staging environment (test.kondense.ai) by default so tests exercise
 * the real Vercel + Supabase + Mux stack — not localhost.
 *
 * Credentials come from .env.local (E2E_ADMIN_*, E2E_MEMBER_*) so
 * we don't commit them.
 *
 * Project layout:
 *   - `setup` runs auth.setup.ts once per browser, persists cookies
 *      to .auth/<role>.json
 *   - `chromium-*`, `firefox-*`, `webkit-*` projects depend on setup
 *      and use the persisted storage state. Specs re-using state
 *      avoid hammering the auth rate limit on cross-browser runs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://test.kondense.ai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium-admin',
      testMatch: /admin-flow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-member',
      testMatch: /member-flow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: '.auth/member.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-admin',
      testMatch: /admin-flow\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-member',
      testMatch: /member-flow\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], storageState: '.auth/member.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-admin',
      testMatch: /admin-flow\.spec\.ts/,
      use: { ...devices['Desktop Safari'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-member',
      testMatch: /member-flow\.spec\.ts/,
      use: { ...devices['Desktop Safari'], storageState: '.auth/member.json' },
      dependencies: ['setup'],
    },
  ],
})
