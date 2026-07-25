'use server'

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { writeAuditLog } from '@/lib/services/audit-log-service'
import {
  deleteAppointment,
  getMonthlyTargets,
  listAppointments,
  listEntriesForMonth,
  listMonthlyAggregates,
  listProductionUsers,
  upsertAppointment,
  upsertEntry,
  upsertMonthlyTargets,
  type AppointmentRow,
  type DailyEntry,
  type ListAppointmentsOptions,
  type MonthlyAggregateRow,
  type MonthlyTargets,
  type ProductionUserOption,
  type UpsertAppointmentInput,
  type UpsertEntryInput,
  type UpsertTargetsInput,
} from '@/lib/services/production-service'

export type {
  AppointmentRow,
  DailyEntry,
  MonthlyAggregateRow,
  MonthlyTargets,
  ProductionUserOption,
  UpsertAppointmentInput,
  UpsertEntryInput,
  UpsertTargetsInput,
} from '@/lib/services/production-service'

/**
 * Access rule: any TEAM user with the `production` grant may read
 * / write their OWN rows. ADMIN may act on any user. This checks the
 * gate + returns whether the actor is scoping to themselves so the
 * caller can enforce the target-user check.
 */
async function requireAccess() {
  const actor = await requireTeamModuleAccess('production')
  return actor
}

function assertOwnOrAdmin(actor: { id: string; role: string }, targetUserId: string) {
  if (actor.role === 'ADMIN') return
  if (actor.id !== targetUserId) {
    throw new Error('forbidden: cannot access another user\'s production data')
  }
}

// ─── READ ─────────────────────────────────────────────────────

export async function fetchEntries(
  userId: string,
  year: number,
  month: number,
): Promise<DailyEntry[]> {
  const actor = await requireAccess()
  assertOwnOrAdmin(actor, userId)
  return listEntriesForMonth(userId, year, month)
}

export async function fetchTargets(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlyTargets> {
  const actor = await requireAccess()
  assertOwnOrAdmin(actor, userId)
  return getMonthlyTargets(userId, year, month)
}

export async function fetchAppointments(
  options: ListAppointmentsOptions & { userId: string },
): Promise<AppointmentRow[]> {
  const actor = await requireAccess()
  assertOwnOrAdmin(actor, options.userId)
  return listAppointments(options)
}

export async function fetchMonthlyAggregates(
  userId: string,
  months?: number,
): Promise<MonthlyAggregateRow[]> {
  const actor = await requireAccess()
  assertOwnOrAdmin(actor, userId)
  return listMonthlyAggregates(userId, months)
}

export async function fetchProductionUsers(): Promise<ProductionUserOption[]> {
  const actor = await requireAccess()
  if (actor.role !== 'ADMIN') return []
  return listProductionUsers()
}

// ─── WRITE ────────────────────────────────────────────────────

export async function saveEntry(
  input: UpsertEntryInput,
): Promise<{ ok: true; entry: DailyEntry } | { ok: false; error: string }> {
  try {
    const actor = await requireAccess()
    assertOwnOrAdmin(actor, input.userId)
    const entry = await upsertEntry(input)
    await writeAuditLog({
      actorId: actor.id,
      action: 'production.entry.save',
      resourceType: 'productionEntry',
      resourceId: entry.id ?? `${input.userId}:${input.date}`,
      summary: `Saved production entry for ${input.date}`,
    })
    revalidatePath('/admin/production-sheets')
    revalidatePath('/team/production-sheets')
    return { ok: true, entry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save entry',
    }
  }
}

export async function saveTargets(
  input: UpsertTargetsInput,
): Promise<{ ok: true; targets: MonthlyTargets } | { ok: false; error: string }> {
  try {
    const actor = await requireAccess()
    assertOwnOrAdmin(actor, input.userId)
    const targets = await upsertMonthlyTargets(input)
    await writeAuditLog({
      actorId: actor.id,
      action: 'production.target.save',
      resourceType: 'productionTarget',
      resourceId: targets.id ?? `${input.userId}:${input.year}-${input.month}`,
      summary: `Updated monthly targets for ${input.year}-${String(input.month).padStart(2, '0')}`,
    })
    revalidatePath('/admin/production-sheets')
    revalidatePath('/team/production-sheets')
    return { ok: true, targets }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save targets',
    }
  }
}

export async function saveAppointment(
  input: UpsertAppointmentInput,
): Promise<{ ok: true; appointment: AppointmentRow } | { ok: false; error: string }> {
  try {
    const actor = await requireAccess()
    // TEAM users can only file appointments they set themselves.
    assertOwnOrAdmin(actor, input.setById)
    const appointment = await upsertAppointment(input)
    await writeAuditLog({
      actorId: actor.id,
      action: input.id ? 'production.appointment.update' : 'production.appointment.create',
      resourceType: 'appointmentSet',
      resourceId: appointment.id,
      summary: `${input.id ? 'Updated' : 'Logged'} appointment for ${input.prospectName}`,
    })
    revalidatePath('/admin/production-sheets')
    revalidatePath('/team/production-sheets')
    return { ok: true, appointment }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save appointment',
    }
  }
}

export async function removeAppointment(
  id: string,
  setById: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireAccess()
    assertOwnOrAdmin(actor, setById)
    await deleteAppointment(id)
    await writeAuditLog({
      actorId: actor.id,
      action: 'production.appointment.delete',
      resourceType: 'appointmentSet',
      resourceId: id,
      summary: 'Deleted appointment',
    })
    revalidatePath('/admin/production-sheets')
    revalidatePath('/team/production-sheets')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete appointment',
    }
  }
}
