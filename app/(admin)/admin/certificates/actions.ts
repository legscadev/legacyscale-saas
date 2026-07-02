'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import {
  emailCertificateToMember,
  getAdminCertificateDownload,
  listAllCertificates,
  manuallyIssueBulkCertificates,
  manuallyIssueCertificate,
  reinstateCertificate,
  revokeCertificate,
  type AdminCertificateFilters,
  type AdminCertificateRow,
  type BulkIssueOutcome,
} from '@/lib/services/admin-certificate-service'

export type { AdminCertificateRow } from '@/lib/services/admin-certificate-service'

export async function fetchCertificates(
  filters: AdminCertificateFilters,
): Promise<AdminCertificateRow[]> {
  await requireAdmin()
  return listAllCertificates(filters)
}

export async function downloadCertificateAction(
  issuanceId: string,
): Promise<{ ok: true; url: string; filename: string } | { ok: false; error: string }> {
  await requireAdmin()
  return getAdminCertificateDownload(issuanceId)
}

export async function emailCertificateAction(
  issuanceId: string,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  await requireAdmin()
  const result = await emailCertificateToMember(issuanceId)
  return result
}

export async function revokeCertificateAction(
  issuanceId: string,
  reason: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin()
  const result = await revokeCertificate(admin.id, issuanceId, reason)
  if (result.ok) revalidatePath('/admin/certificates')
  return result
}

export async function reinstateCertificateAction(
  issuanceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  const result = await reinstateCertificate(issuanceId)
  if (result.ok) revalidatePath('/admin/certificates')
  return result
}

export async function issueCertificateAction(
  userId: string,
  moduleId: string,
): Promise<{ ok: true; issuanceId: string } | { ok: false; error: string }> {
  const admin = await requireAdmin()
  const result = await manuallyIssueCertificate(admin.id, { userId, moduleId })
  if (result.ok) revalidatePath('/admin/certificates')
  return result
}

export async function issueCertificatesBulkAction(
  userId: string,
  moduleIds: string[],
):
  Promise<
    | { ok: true; issuedCount: number; results: BulkIssueOutcome[] }
    | { ok: false; error: string }
  > {
  const admin = await requireAdmin()
  const result = await manuallyIssueBulkCertificates(admin.id, userId, moduleIds)
  if (result.ok && result.issuedCount > 0) {
    revalidatePath('/admin/certificates')
  }
  return result
}

// ─── Pickers for the Issue-cert dialog ───

export interface MemberPickerOption {
  id: string
  name: string | null
  email: string
}

export interface CoursePickerOption {
  id: string
  title: string
  certificateEnabled: boolean
  moduleCount: number
}

export interface ModulePickerRow {
  id: string
  title: string
  /** True when the (user, module) already has an ACTIVE issuance —
   *  UI disables the checkbox and marks it as issued. */
  alreadyIssued: boolean
  /** True when the row exists but is revoked — UI hints toward the
   *  reinstate action instead. */
  hasRevokedIssuance: boolean
}

export async function listMembersForCertPicker(): Promise<MemberPickerOption[]> {
  await requireAdmin()
  return prisma.user.findMany({
    where: { role: 'MEMBER', isActive: true, deletedAt: null },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: { id: true, name: true, email: true },
    take: 500,
  })
}

/**
 * All non-deleted courses, regardless of certificateEnabled. Admin
 * override lets Ruby hand-issue for any course; the auto-issue hook
 * still respects certificateEnabled for the automatic path.
 */
export async function listCoursesForCertPicker(): Promise<CoursePickerOption[]> {
  await requireAdmin()
  const rows = await prisma.course.findMany({
    where: { deletedAt: null },
    orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      certificateEnabled: true,
      _count: { select: { modules: { where: { deletedAt: null } } } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    certificateEnabled: r.certificateEnabled,
    moduleCount: r._count.modules,
  }))
}

export async function listModulesByCourseForCertPicker(
  courseId: string,
  memberId?: string,
): Promise<ModulePickerRow[]> {
  await requireAdmin()
  const modules = await prisma.module.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, title: true },
  })

  // Grab the member's existing issuances for this course in one shot
  // so we can mark modules that are already covered.
  const existing = memberId
    ? await prisma.certificateIssuance.findMany({
        where: { userId: memberId, courseId },
        select: { moduleId: true, revokedAt: true },
      })
    : []
  const byModule = new Map<string, { revokedAt: Date | null }>()
  for (const e of existing) byModule.set(e.moduleId, { revokedAt: e.revokedAt })

  return modules.map((m) => {
    const state = byModule.get(m.id)
    return {
      id: m.id,
      title: m.title,
      alreadyIssued: !!state && state.revokedAt === null,
      hasRevokedIssuance: !!state && state.revokedAt !== null,
    }
  })
}
