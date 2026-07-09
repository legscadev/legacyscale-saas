import { test as setup } from '@playwright/test'

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  MEMBER_EMAIL,
  MEMBER_PASSWORD,
  TENANT_A_ADMIN_EMAIL,
  TENANT_A_ADMIN_PASSWORD,
  signIn,
} from './helpers'

/**
 * Two setup tests, one per role. Each signs in via the real form
 * then writes its session cookies + localStorage to a JSON file. The
 * spec projects later load those files via `storageState` so the
 * tests themselves don't re-submit the login form — keeps the IP
 * under the auth rate limit even when cross-browser runs fan out.
 */

export const ADMIN_STORAGE = '.auth/admin.json'
export const MEMBER_STORAGE = '.auth/member.json'
export const TENANT_A_ADMIN_STORAGE = '.auth/tenant-a-admin.json'

setup('authenticate as admin', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.context().storageState({ path: ADMIN_STORAGE })
})

setup('authenticate as member', async ({ page }) => {
  await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
  await page.context().storageState({ path: MEMBER_STORAGE })
})

setup('authenticate as tenant-a admin', async ({ page }) => {
  await signIn(page, TENANT_A_ADMIN_EMAIL, TENANT_A_ADMIN_PASSWORD)
  await page.context().storageState({ path: TENANT_A_ADMIN_STORAGE })
})
