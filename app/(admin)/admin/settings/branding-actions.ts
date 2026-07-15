'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { brandingInputSchema, type BrandingInput } from '@/lib/branding/schema'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveCompany } from '@/lib/tenancy/active-company'

import { Prisma } from '@prisma/client'

const BRAND_ASSET_BUCKET = 'course-thumbnails'
const MAX_ASSET_BYTES = 5 * 1024 * 1024 // 5 MB — logos are small
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

const ASSET_KINDS = ['logo', 'logoDark', 'favicon', 'og'] as const
export type BrandingAssetKind = (typeof ASSET_KINDS)[number]

export interface BrandingUploadResult {
  ok: boolean
  url?: string
  error?: string
}

export interface BrandingSaveResult {
  ok: boolean
  error?: string
}

/** String-valued keys the form can submit. Booleans + enums have
 *  their own handling below. */
const STRING_KEYS = [
  // Identity
  'productName',
  'tagline',
  'supportEmail',
  'supportUrl',
  'fromName',
  'legalCompany',
  'privacyUrl',
  'termsUrl',
  // Logos & icons
  'logoUrl',
  'logoDarkUrl',
  'faviconUrl',
  'ogImageUrl',
  // Colors
  'primaryColor',
  'accentColor',
  'backgroundColor',
  'sidebarBgColor',
  'destructiveColor',
] as const

const ENUM_KEYS = [
  'fontFamily',
  'borderRadius',
  'buttonStyle',
] as const

const BOOLEAN_KEYS = ['darkModeDefault'] as const

/**
 * Upload a brand asset (logo / favicon / OG image) to the shared
 * course-thumbnails bucket under `<companyId>/brand/…` so RLS +
 * tenant-prefix conventions match the rest of the file storage. The
 * returned URL is what the caller stores on `Company.brand`.
 *
 * We route through a server action (rather than a signed browser
 * upload) because branding assets are small (a favicon is ~15 KB, a
 * logo maybe a few hundred KB) and Vercel Server Actions accept up
 * to 12 MB (`next.config.ts` `serverActions.bodySizeLimit`).
 */
export async function uploadBrandingAssetAction(
  formData: FormData,
): Promise<BrandingUploadResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return { ok: false, error: 'No active company.' }

  const kindRaw = String(formData.get('kind') ?? '')
  if (!ASSET_KINDS.includes(kindRaw as BrandingAssetKind)) {
    return { ok: false, error: `Unknown asset kind: ${kindRaw}` }
  }
  const kind = kindRaw as BrandingAssetKind

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file provided.' }
  }
  if (file.size > MAX_ASSET_BYTES) {
    return {
      ok: false,
      error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max 5 MB.`,
    }
  }
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      error: `Unsupported file type (${mime}). PNG, JPEG, WebP, SVG, or ICO only.`,
    }
  }

  const ext =
    mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon'
      ? 'ico'
      : mime === 'image/svg+xml'
        ? 'svg'
        : (mime.split('/')[1]?.split('+')[0] ?? 'png')
  const path = `${company.id}/brand/${kind}-${randomUUID()}.${ext}`

  const supabase = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabase.storage
    .from(BRAND_ASSET_BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadErr) {
    console.error('brand asset upload failed:', uploadErr)
    return { ok: false, error: 'Upload failed — try again.' }
  }
  const { data } = supabase.storage.from(BRAND_ASSET_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

/**
 * Explicitly clear the active company's brand JSON. The row-level
 * NULL is what the theme-lock check in the shell keys off — writing
 * "Kondense values" through the update path would still count as a
 * custom palette and keep the light/dark toggle disabled. This
 * action gives the "Reset to platform defaults" button in the
 * BrandingCard a way out.
 */
export async function clearBrandingAction(): Promise<BrandingSaveResult> {
  await requireAdmin()
  const company = await getActiveCompany()
  if (!company) return { ok: false, error: 'No active company.' }
  try {
    await prisma.company.update({
      where: { id: company.id },
      data: { brand: Prisma.DbNull as unknown as Prisma.InputJsonValue },
    })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    console.error('clearBrandingAction failed:', err)
    return { ok: false, error: 'Could not reset branding' }
  }
}

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

  // Company identity fields (name + slug) live on the Company row,
  // not the brand JSON, and are extracted before the branding parse.
  // Both are optional on the wire — omitting them is a no-op for that
  // field. Uniqueness on slug is enforced with a lookup here so the
  // operator gets an inline field error instead of a raw DB error.
  const companyNameRaw = formData.get('companyName')
  const companySlugRaw = formData.get('companySlug')
  const companyPatch: { name?: string; slug?: string } = {}
  if (typeof companyNameRaw === 'string') {
    const trimmed = companyNameRaw.trim()
    if (trimmed !== '' && trimmed !== company.name) {
      if (trimmed.length > 120) {
        return { ok: false, error: 'Company name must be at most 120 chars.' }
      }
      companyPatch.name = trimmed
    }
  }
  if (typeof companySlugRaw === 'string') {
    const normalized = normalizeSlugInput(companySlugRaw)
    if (normalized !== '' && normalized !== company.slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
        return {
          ok: false,
          error:
            'Slug can only contain lowercase letters, numbers, and hyphens.',
        }
      }
      if (normalized.length < 2 || normalized.length > 60) {
        return { ok: false, error: 'Slug must be 2–60 characters.' }
      }
      const clash = await prisma.company.findFirst({
        where: { slug: normalized, id: { not: company.id }, deletedAt: null },
        select: { id: true },
      })
      if (clash) {
        return { ok: false, error: 'This slug is already in use.' }
      }
      companyPatch.slug = normalized
    }
  }

  const raw: Record<string, unknown> = {}
  for (const key of STRING_KEYS) {
    const value = formData.get(key)
    if (typeof value === 'string' && value.trim() !== '') {
      raw[key] = value.trim()
    }
  }
  for (const key of ENUM_KEYS) {
    const value = formData.get(key)
    if (typeof value === 'string' && value.trim() !== '') {
      raw[key] = value.trim()
    }
  }
  // Booleans have no "empty" state — the checkbox is always either
  // checked or unchecked. Only persist them when some other field is
  // set; otherwise the brand column can never fall back to NULL and
  // the theme toggle stays locked forever after a single accidental
  // save. See docs discussion re: adaptive foreground rewrite.
  const hasOtherData = Object.keys(raw).length > 0
  if (hasOtherData) {
    for (const key of BOOLEAN_KEYS) {
      raw[key] = formData.get(key) === '1'
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
      data: {
        ...companyPatch,
        brand: hasAny
          ? (parsed.data as unknown as Prisma.InputJsonValue)
          : (Prisma.DbNull as unknown as Prisma.InputJsonValue),
      },
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

/** Same normalisation the super/create-company path uses — accept
 *  mixed case + spaces on input, spit out a URL-safe slug. */
function normalizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
