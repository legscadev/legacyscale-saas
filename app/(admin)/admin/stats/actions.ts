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

export async function fetchAllMetrics(): Promise<StatMetricRow[]> {
  await requireActiveUser()
  return listAllMetrics()
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

// ─── PICKER: users eligible to be assigned ─────────────────────

export interface AssigneePickerOption {
  id: string
  name: string | null
  email: string
  role: 'ADMIN' | 'TEAM' | 'MEMBER'
  /** Onboarding lifecycle from the linked Employee record.
   *  - 'ACTIVE'     — currently onboarded
   *  - 'OFFBOARDED' — ex-employee, kept for historical metrics
   *  - null         — no Employee record (admin without HR row) */
  employmentStatus: 'ACTIVE' | 'OFFBOARDED' | null
}

export async function listAssigneesForStats(): Promise<AssigneePickerOption[]> {
  await requireTeamModuleAccess('stats')
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: { in: ['ADMIN', 'TEAM'] },
      ...(await memberTenantScope()),
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employee: { select: { status: true } },
    },
    take: 500,
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as AssigneePickerOption['role'],
    employmentStatus: r.employee?.status ?? null,
  }))
}
