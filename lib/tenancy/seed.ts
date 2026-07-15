/**
 * The platform seed Company id. Load-bearing across the schema:
 * every `companyId` column defaults to this uuid, and every place
 * that needs to identify "the platform tenant" (delete guard,
 * onboarding-callout suppression, /super badges) keys off this
 * constant instead of a slug — the slug is user-editable, the id is
 * not, so this stays reliable even after a rename.
 */
export const PLATFORM_SEED_COMPANY_ID =
  '00000000-0000-0000-0000-000000000001'
