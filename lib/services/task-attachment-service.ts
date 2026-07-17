// Task attachments — Supabase Storage bytes + a TaskAttachment
// metadata row that anchors them to a task. Bucket is PRIVATE;
// downloads go through signed URLs (createSignedUrl with a short
// TTL) so ownership stays enforced.
//
// Storage layout: task-attachments/<companyId>/<taskId>/<uuid>-<name>.
// The companyId prefix keeps tenants strictly separated on disk;
// the uuid prefix on the filename prevents collisions when two
// admins upload the same source file name to the same task.

import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { taskActivityService } from '@/lib/services/task-activity-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

/** Supabase Storage bucket. Created on-demand at first upload —
 *  Supabase's service-role client can bootstrap buckets. */
export const TASK_ATTACHMENT_BUCKET = 'task-attachments'

/** Cap per attachment. Server actions on Vercel accept up to 12 MB
 *  by default, so this is a conservative operational limit that
 *  keeps us clear of that ceiling without a per-project override. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Signed URL TTL for download links. Long enough to click through
 *  a toast + save-as dialog, short enough that a leaked URL isn't a
 *  standing exposure. */
export const SIGNED_URL_TTL_SECONDS = 60

export class TaskAttachmentNotFoundError extends Error {
  constructor(message = 'Attachment not found') {
    super(message)
    this.name = 'TaskAttachmentNotFoundError'
  }
}

// One-shot bucket bootstrap guard so we only issue the
// getBucket/createBucket round trip once per process. Reset on
// server restart (fine — this is a cache, not correctness).
let bucketReady: Promise<void> | null = null

/** Idempotent bucket bootstrap. First caller reaches into Supabase
 *  Admin to check-or-create; subsequent callers await the same
 *  promise. Rethrows on failure so upload attempts fail fast. */
async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady
  bucketReady = (async () => {
    const supabase = createAdminClient()
    const { data: existing } = await supabase.storage.getBucket(
      TASK_ATTACHMENT_BUCKET,
    )
    if (existing) return
    const { error: createErr } = await supabase.storage.createBucket(
      TASK_ATTACHMENT_BUCKET,
      { public: false, fileSizeLimit: MAX_ATTACHMENT_BYTES },
    )
    // "already exists" races between concurrent boots are benign
    // — treat them as success.
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(
        `Could not create ${TASK_ATTACHMENT_BUCKET} bucket: ${createErr.message}`,
      )
    }
  })().catch((err) => {
    // Reset the guard on failure so a fixed configuration retries
    // on the next call instead of poisoning the process.
    bucketReady = null
    throw err
  })
  return bucketReady
}

// ============================================
// PUBLIC SHAPES
// ============================================

export interface TaskAttachmentRow {
  id: string
  taskId: string
  name: string
  path: string
  size: number
  mimeType: string
  /** Set for link attachments — an external URL (Google Drive,
   *  Frame.io, Figma, etc.) instead of storage bytes. When
   *  present, the client opens this directly and never touches
   *  Supabase Storage for this row. */
  sourceUrl: string | null
  uploadedBy: { id: string; name: string | null } | null
  createdAt: Date
}

/** Marker mimeType we stamp on link rows so filters, badges, and
 *  future export code can branch on kind without a schema join. */
export const LINK_MIMETYPE = 'link/external'

const ATTACHMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.TaskAttachmentInclude

type AttachmentWithIncludes = Prisma.TaskAttachmentGetPayload<{
  include: typeof ATTACHMENT_INCLUDE
}>

function mapRow(row: AttachmentWithIncludes): TaskAttachmentRow {
  return {
    id: row.id,
    taskId: row.taskId,
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
  if (!id) throw new Error('task-attachment-service: no active company')
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

class TaskAttachmentService {
  async listForTask(taskId: string): Promise<TaskAttachmentRow[]> {
    const rows = await prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    })
    return rows.map(mapRow)
  }

  /**
   * End-to-end upload: bytes → storage, metadata → DB, event → log.
   * Called by the server action; verifies the task belongs to the
   * current tenant (via the auto-scoped find) before touching
   * storage so an unauthorized caller can't smuggle bytes into
   * someone else's namespace.
   */
  async upload(args: {
    taskId: string
    file: File
    actorId: string | null
  }): Promise<TaskAttachmentRow> {
    const companyId = await requireCompanyId()

    // Auto-scoped find — if the task isn't in the current tenant
    // the extension makes this return null and we bail before any
    // storage cost.
    const task = await prisma.task.findFirst({
      where: { id: args.taskId, deletedAt: null },
      select: { id: true },
    })
    if (!task) throw new Error('Task not found')

    if (args.file.size === 0) throw new Error('File is empty')
    if (args.file.size > MAX_ATTACHMENT_BYTES) {
      const mb = (args.file.size / 1024 / 1024).toFixed(1)
      throw new Error(`File is ${mb} MB — max 10 MB.`)
    }

    await ensureBucket()

    const supabase = createAdminClient()
    const mime = args.file.type || 'application/octet-stream'
    const rawName = args.file.name || 'file'
    const safeName = safeFileName(rawName)
    const uuid = randomUUID()
    const path = `${companyId}/${args.taskId}/${uuid}-${safeName}`

    const buffer = Buffer.from(await args.file.arrayBuffer())
    const { error: uploadErr } = await supabase.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .upload(path, buffer, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadErr) {
      throw new Error(`Upload failed: ${uploadErr.message}`)
    }

    // Register the row. If this fails after the storage write we'd
    // leak an orphan file, so we make a best-effort delete on the
    // DB error path.
    let created: AttachmentWithIncludes
    try {
      created = await prisma.taskAttachment.create({
        data: {
          taskId: args.taskId,
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
        .from(TASK_ATTACHMENT_BUCKET)
        .remove([path])
        .catch(() => {})
      throw err
    }

    await taskActivityService.logEvent({
      taskId: args.taskId,
      actorId: args.actorId,
      action: 'attachment_added',
      toValue: { id: created.id, name: rawName, size: args.file.size },
    })

    return mapRow(created)
  }

  /**
   * Register a link attachment — a URL bookmark that lives on the
   * task without any storage bytes. Fills path/size/mimeType with
   * placeholder values so the columns stay NOT NULL; the sourceUrl
   * column is the discriminator every read path branches on.
   */
  async registerLink(args: {
    taskId: string
    name: string
    url: string
    actorId: string | null
  }): Promise<TaskAttachmentRow> {
    const task = await prisma.task.findFirst({
      where: { id: args.taskId, deletedAt: null },
      select: { id: true },
    })
    if (!task) throw new Error('Task not found')

    // Normalize display name — if the caller left it blank, fall
    // back to the URL host so the row is scannable in the drawer.
    const displayName = args.name.trim() || safeHostFromUrl(args.url)

    const created = await prisma.taskAttachment.create({
      data: {
        taskId: args.taskId,
        name: displayName,
        path: '',
        size: 0,
        mimeType: LINK_MIMETYPE,
        sourceUrl: args.url,
        uploadedById: args.actorId,
      },
      include: ATTACHMENT_INCLUDE,
    })

    await taskActivityService.logEvent({
      taskId: args.taskId,
      actorId: args.actorId,
      action: 'attachment_added',
      toValue: { id: created.id, name: displayName, url: args.url },
    })

    return mapRow(created)
  }

  /** Remove metadata + (for uploaded rows) storage bytes. Metadata
   *  delete first — if storage remove fails the DB row is gone and
   *  the file becomes an orphan; safer failure mode (row is the
   *  source of truth, bytes are recoverable via a bucket audit).
   *  Link rows skip the storage remove entirely — there's nothing
   *  to clean up server-side. */
  async delete(
    attachmentId: string,
    actorId: string | null,
  ): Promise<void> {
    const row = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        taskId: true,
        path: true,
        name: true,
        sourceUrl: true,
      },
    })
    if (!row) throw new TaskAttachmentNotFoundError()

    await prisma.taskAttachment.delete({ where: { id: attachmentId } })

    if (row.sourceUrl === null && row.path) {
      const supabase = createAdminClient()
      await supabase.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .remove([row.path])
        .catch((err) => {
          console.error(
            `[task-attachments] orphaned storage object ${row.path}:`,
            err,
          )
        })
    }

    await taskActivityService.logEvent({
      taskId: row.taskId,
      actorId,
      action: 'attachment_removed',
      fromValue: { id: attachmentId, name: row.name },
    })
  }

  /**
   * Resolve a "download" URL. For uploaded rows, mints a short-
   * lived signed Supabase URL. For link rows, returns sourceUrl
   * unchanged — the caller just window.open's it.
   */
  async signDownloadUrl(attachmentId: string): Promise<string> {
    const row = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, path: true, name: true, sourceUrl: true },
    })
    if (!row) throw new TaskAttachmentNotFoundError()

    if (row.sourceUrl) return row.sourceUrl

    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .createSignedUrl(row.path, SIGNED_URL_TTL_SECONDS, {
        download: row.name,
      })
    if (error || !data) {
      throw new Error(`Could not sign download URL: ${error?.message}`)
    }
    return data.signedUrl
  }
}

/** Best-effort host extraction for the link-attachment fallback
 *  display name. Returns the raw URL if parsing fails so the row
 *  is still identifiable. */
function safeHostFromUrl(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export const taskAttachmentService = new TaskAttachmentService()
