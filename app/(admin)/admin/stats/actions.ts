'use server'

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { memberTenantScope } from '@/lib/tenancy/request-company'
import {
  archiveDivision,
  archiveMetric,
  createDivision,
  createMetric,
  deleteDataPoint,
  deleteDivision,
  deleteMetric,
  listAllMetrics,
  listDivisions,
  listMetricsForDivision,
  updateDivision,
  updateMetric,
  upsertDataPoint,
  type CreateDivisionInput,
  type CreateMetricInput,
  type StatDivisionSummary,
  type StatMetricRow,
  type UpdateDivisionInput,
  type UpdateMetricInput,
  type UpsertDataPointInput,
} from '@/lib/services/stat-tracker-service'

export type {
  StatDivisionSummary,
  StatMetricRow,
} from '@/lib/services/stat-tracker-service'

// ─── READ ─────────────────────────────────────────────────────

export async function fetchDivisions(): Promise<StatDivisionSummary[]> {
  await requireActiveUser()
  return listDivisions()
}

export async function fetchDivisionMetrics(
  divisionId: string,
): Promise<StatMetricRow[]> {
  await requireActiveUser()
  return listMetricsForDivision(divisionId)
}

/** Points window covers ~2 months so the monthly table view can
 *  show the current + previous month without a second fetch. The
 *  chart view still uses the first 26 (reverse-chronological order
 *  matches the sparkline's oldest-first layout after `shapeMetricRow`
 *  reverses). */
export async function fetchAllMetrics(): Promise<StatMetricRow[]> {
  await requireActiveUser()
  return listAllMetrics(62)
}

// ─── WRITE — admin only ────────────────────────────────────────

export async function createDivisionAction(
  input: CreateDivisionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await createDivision(input)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function updateDivisionAction(
  id: string,
  input: UpdateDivisionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await updateDivision(id, input)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function archiveDivisionAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await archiveDivision(id)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function deleteDivisionAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await deleteDivision(id)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function createMetricAction(
  input: CreateMetricInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await createMetric(input)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function updateMetricAction(
  id: string,
  input: UpdateMetricInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await updateMetric(id, input)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function archiveMetricAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await archiveMetric(id)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function deleteMetricAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTeamModuleAccess('stats')
  const result = await deleteMetric(id)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

// ─── WRITE — assignee or admin ────────────────────────────────

export async function upsertDataPointAction(
  input: UpsertDataPointInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireActiveUser()
  const isAdmin = user.role === 'ADMIN'
  const result = await upsertDataPoint(user.id, isAdmin, input)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

export async function deleteDataPointAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireActiveUser()
  const isAdmin = user.role === 'ADMIN'
  const result = await deleteDataPoint(user.id, isAdmin, id)
  if (result.ok) revalidatePath('/admin/stats')
  return result
}

// ─── PICKER: employees eligible to own a metric ────────────────

export interface AssigneePickerOption {
  /** Employee.id — used as the metric's assignedToId. */
  id: string
  /** Linked User.id (null when the Employee has no system access).
   *  Used by "Only mine" and edit-permission checks in the UI. */
  userId: string | null
  name: string
  roleTitle: string
  employmentStatus: 'ACTIVE' | 'OFFBOARDED'
}

/**
 * Assignees for the stats picker come from the HR roster
 * (/admin/onboarding), not the system-access list. Offboarded
 * employees stay in the list so historical stat imports can still
 * attribute metrics to whoever actually owned them at the time.
 */
export async function listAssigneesForStats(): Promise<AssigneePickerOption[]> {
  await requireTeamModuleAccess('stats')
  const rows = await prisma.employee.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      userId: true,
      name: true,
      roleTitle: true,
      status: true,
    },
    take: 500,
  })
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    roleTitle: r.roleTitle,
    employmentStatus: r.status,
  }))
}
