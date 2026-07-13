'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { brandingInputSchema, type BrandingInput } from '@/lib/branding/schema'
import { prisma } from '@/lib/prisma'
import { getActiveCompany } from '@/lib/tenancy/active-company'

import { Prisma } from '@prisma/client'

export interface BrandingSaveResult {
  ok: boolean
  error?: string
}

/** Every branding key the form can submit. Kept in one place so
 *  reads + writes stay in sync when we add new fields later. */
const BRANDING_KEYS = [
  'productName',
  'tagline',
  'supportEmail',
  'fromName',
  'legalCompany',
  'primaryColor',
  'accentColor',
  'logoUrl',
  'logoDarkUrl',
  'faviconUrl',
  'ogImageUrl',
  'supportUrl',
  'privacyUrl',
  'termsUrl',
] as const

/**
 * Read the current tenant's brand JSON for the form defaults. Returns
 * `null` when tenancy is off (no active company) or the stored blob
 * is malformed — the form then falls back to placeholders.
 */
export async function getCurrentBrandingAction(): Promise<BrandingInput | null> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company?.brand) return null
  const parsed = brandingInputSchema.safeParse(company.brand)
  return parsed.success ? parsed.data : null
}

/**
 * Persist the submitted form fields onto the active company's brand
 * JSON. Empty strings drop out so tenants can clear a field back to
 * the platform default. If every field is blank, the whole column is
 * cleared and `getBranding()` falls through to DEFAULT_BRANDING.
 */
export async function updateBrandingAction(
  formData: FormData,
): Promise<BrandingSaveResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) {
    return {
      ok: false,
      error:
        'No active company to update. Enable TENANCY_ENABLED and select a tenant first.',
    }
  }

  const raw: Record<string, unknown> = {}
  for (const key of BRANDING_KEYS) {
    const value = formData.get(key)
    if (typeof value === 'string' && value.trim() !== '') {
      raw[key] = value.trim()
    }
  }

  const parsed = brandingInputSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.') ?? 'field'
    return { ok: false, error: `${path}: ${issue?.message ?? 'invalid'}` }
  }

  try {
    const hasAny = Object.keys(parsed.data).length > 0
    await prisma.company.update({
      where: { id: company.id },
      data: hasAny
        ? { brand: parsed.data as unknown as Prisma.InputJsonValue }
        : { brand: Prisma.JsonNull as unknown as Prisma.InputJsonValue },
    })
    // Layouts + root metadata both call getBranding(); revalidate the
    // whole layout tree so the sidebar / <title> / favicon pick up
    // the change on the next request.
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    console.error('updateBrandingAction failed:', err)
    return { ok: false, error: 'Could not save branding' }
  }
}
