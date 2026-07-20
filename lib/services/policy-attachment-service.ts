// Policy attachments — Supabase Storage bytes + a PolicyAttachment
// metadata row that anchors them to a policy. Bucket is PRIVATE;
// downloads go through signed URLs (createSignedUrl with a short
// TTL) so ownership stays enforced.
//
// Storage layout: policy-attachments/<companyId>/<policyId>/<uuid>-<name>.
// The companyId prefix keeps tenants strictly separated on disk;
// the uuid prefix on the filename prevents collisions when two
// admins upload the same source file name to the same policy.
//
// Mirrors task-attachment-service so both surfaces stay legible
// side-by-side. Any change to one is a candidate for the other.

import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { policyActivityService } from '@/lib/services/policy-activity-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

/** Supabase Storage bucket. Created on-demand at first upload —
 *  Supabase's service-role client can bootstrap buckets. */
export const POLICY_ATTACHMENT_BUCKET = 'policy-attachments'

/** Cap per attachment. Same conservative operational ceiling as
 *  task attachments to stay clear of Vercel's default 12 MB
 *  server-action body limit. */
export const MAX_POLICY_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Signed URL TTL for download links. Long enough to click through
 *  a save-as dialog, short enough that a leaked URL isn't a
 *  standing exposure. */
export const SIGNED_URL_TTL_SECONDS = 60

export class PolicyAttachmentNotFoundError extends Error {
  constructor(message = 'Attachment not found') {
    super(message)
    this.name = 'PolicyAttachmentNotFoundError'
  }
}

// One-shot bucket bootstrap guard. Reset on server restart (fine —
// this is a cache, not correctness).
let bucketReady: Promise<void> | null = null

async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady
  bucketReady = (async () => {
    const supabase = createAdminClient()
    const { data: existing } = await supabase.storage.getBucket(
      POLICY_ATTACHMENT_BUCKET,
    )
    if (existing) return
    const { error: createErr } = await supabase.storage.createBucket(
      POLICY_ATTACHMENT_BUCKET,
      { public: false, fileSizeLimit: MAX_POLICY_ATTACHMENT_BYTES },
    )
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(
        `Could not create ${POLICY_ATTACHMENT_BUCKET} bucket: ${createErr.message}`,
      )
    }
  })().catch((err) => {
    bucketReady = null
    throw err
  })
  return bucketReady
}

// ============================================
// PUBLIC SHAPES
// ============================================

export interface PolicyAttachmentRow {
  id: string
  policyId: string
  name: string
  path: string
  size: number
  mimeType: string
  /** Set for link attachments — an external URL (Google Drive,
   *  Figma, Loom, etc.) instead of storage bytes. When present, the
   *  client opens this directly and never touches Supabase Storage
   *  for this row. */
  sourceUrl: string | null
  uploadedBy: { id: string; name: string | null } | null
  createdAt: Date
}

/** Marker mimeType stamped on link rows so filters + badges can
 *  branch on kind without a schema join. */
export const LINK_MIMETYPE = 'link/external'

const ATTACHMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.PolicyAttachmentInclude

type AttachmentWithIncludes = Prisma.PolicyAttachmentGetPayload<{
  include: typeof ATTACHMENT_INCLUDE
}>

function mapRow(row: AttachmentWithIncludes): PolicyAttachmentRow {
  return {
    id: row.id,
    policyId: row.policyId,
    name: row.name,
    path: row.path,
    size: row.size,
    mimeType: row.mimeType,
    sourceUrl: row.sourceUrl,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('policy-attachment-service: no active company')
  return id
}

/** Turn a user-supplied filename into something safe to write to
 *  disk. Preserves the extension, replaces every other unsafe char
 *  with a hyphen, collapses runs of hyphens, trims to 100 chars so
 *  the storage path stays reasonable. */
function safeFileName(raw: string): string {
  const trimmed = raw.trim() || 'file'
  const lastDot = trimmed.lastIndexOf('.')
  const ext =
    lastDot > 0 ? trimmed.slice(lastDot).toLowerCase().replace(/[^\w.]/g, '') : ''
  const base = (lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return `${base || 'file'}${ext}`
}

// ============================================
// SERVICE
// ============================================

class PolicyAttachmentService {
  async listForPolicy(policyId: string): Promise<PolicyAttachmentRow[]> {
    const rows = await prisma.policyAttachment.findMany({
      where: { policyId },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    })
    return rows.map(mapRow)
  }

  /**
   * End-to-end upload: bytes → storage, metadata → DB, event → log.
   * Verifies the policy belongs to the current tenant (via the
   * auto-scoped find) before touching storage so an unauthorized
   * caller can't smuggle bytes into someone else's namespace.
   */
  async upload(args: {
    policyId: string
    file: File
    actorId: string | null
  }): Promise<PolicyAttachmentRow> {
    const companyId = await requireCompanyId()

    const policy = await prisma.policy.findFirst({
      where: { id: args.policyId, deletedAt: null },
      select: { id: true },
    })
    if (!policy) throw new Error('Policy not found')

    if (args.file.size === 0) throw new Error('File is empty')
    if (args.file.size > MAX_POLICY_ATTACHMENT_BYTES) {
      const mb = (args.file.size / 1024 / 1024).toFixed(1)
      throw new Error(`File is ${mb} MB — max 10 MB.`)
    }

    await ensureBucket()

    const supabase = createAdminClient()
    const mime = args.file.type || 'application/octet-stream'
    const rawName = args.file.name || 'file'
    const safeName = safeFileName(rawName)
    const uuid = randomUUID()
    const path = `${companyId}/${args.policyId}/${uuid}-${safeName}`

    const buffer = Buffer.from(await args.file.arrayBuffer())
    const { error: uploadErr } = await supabase.storage
      .from(POLICY_ATTACHMENT_BUCKET)
      .upload(path, buffer, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadErr) {
      throw new Error(`Upload failed: ${uploadErr.message}`)
    }

    // Register the row. If this fails after the storage write we'd
    // leak an orphan file — best-effort delete on the DB error path.
    let created: AttachmentWithIncludes
    try {
      created = await prisma.policyAttachment.create({
        data: {
          policyId: args.policyId,
          name: rawName,
          path,
          size: args.file.size,
          mimeType: mime,
          uploadedById: args.actorId,
        },
        include: ATTACHMENT_INCLUDE,
      })
    } catch (err) {
      await supabase.storage
        .from(POLICY_ATTACHMENT_BUCKET)
        .remove([path])
        .catch(() => {})
      throw err
    }

    await policyActivityService.logEvent({
      policyId: args.policyId,
      actorId: args.actorId,
      action: 'attachment_added',
      toValue: { id: created.id, name: rawName, size: args.file.size },
    })

    return mapRow(created)
  }

  /**
   * Register a link attachment — a URL bookmark that lives on the
   * policy without any storage bytes. Path/size/mimeType are
   * placeholders; sourceUrl is the discriminator every read branches
   * on.
   */
  async registerLink(args: {
    policyId: string
    name: string
    url: string
    actorId: string | null
  }): Promise<PolicyAttachmentRow> {
    const policy = await prisma.policy.findFirst({
      where: { id: args.policyId, deletedAt: null },
      select: { id: true },
    })
    if (!policy) throw new Error('Policy not found')

    const displayName = args.name.trim() || safeHostFromUrl(args.url)

    const created = await prisma.policyAttachment.create({
      data: {
        policyId: args.policyId,
        name: displayName,
        path: '',
        size: 0,
        mimeType: LINK_MIMETYPE,
        sourceUrl: args.url,
        uploadedById: args.actorId,
      },
      include: ATTACHMENT_INCLUDE,
    })

    await policyActivityService.logEvent({
      policyId: args.policyId,
      actorId: args.actorId,
      action: 'attachment_added',
      toValue: { id: created.id, name: displayName, url: args.url },
    })

    return mapRow(created)
  }

  /** Metadata delete first — if storage remove fails the row is
   *  gone and the file becomes an orphan; safer failure mode (row
   *  is source of truth, bytes are recoverable via a bucket audit).
   *  Link rows skip the storage remove entirely. */
  async delete(attachmentId: string, actorId: string | null): Promise<void> {
    const row = await prisma.policyAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        policyId: true,
        path: true,
        name: true,
        sourceUrl: true,
      },
    })
    if (!row) throw new PolicyAttachmentNotFoundError()

    await prisma.policyAttachment.delete({ where: { id: attachmentId } })

    if (row.sourceUrl === null && row.path) {
      const supabase = createAdminClient()
      await supabase.storage
        .from(POLICY_ATTACHMENT_BUCKET)
        .remove([row.path])
        .catch((err) => {
          console.error(
            `[policy-attachments] orphaned storage object ${row.path}:`,
            err,
          )
        })
    }

    await policyActivityService.logEvent({
      policyId: row.policyId,
      actorId,
      action: 'attachment_removed',
      fromValue: { id: attachmentId, name: row.name },
    })
  }

  /** Uploaded rows → short-lived signed Supabase URL. Link rows →
   *  sourceUrl unchanged (caller window.open's it). */
  async signDownloadUrl(attachmentId: string): Promise<string> {
    const row = await prisma.policyAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, path: true, name: true, sourceUrl: true },
    })
    if (!row) throw new PolicyAttachmentNotFoundError()

    if (row.sourceUrl) return row.sourceUrl

    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from(POLICY_ATTACHMENT_BUCKET)
      .createSignedUrl(row.path, SIGNED_URL_TTL_SECONDS, {
        download: row.name,
      })
    if (error || !data) {
      throw new Error(`Could not sign download URL: ${error?.message}`)
    }
    return data.signedUrl
  }
}

function safeHostFromUrl(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export const policyAttachmentService = new PolicyAttachmentService()
