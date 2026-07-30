'use server'

// Server actions for the CRM Leads module (P0 #2). Thin controllers:
// auth (crm-leads module) → Zod parse → service → revalidate →
// {ok,...}. Same shape as the pipeline + task-tracker actions.

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { listAssignableSalesUsers } from '@/lib/services/crm-assignable-users'
import {
  ContactViewNotFoundError,
  crmContactViewService,
  type ContactViewRow,
} from '@/lib/services/crm-contact-view-service'
import { crmImportJobService } from '@/lib/services/crm-import-job-service'
import {
  crmLeadService,
  LeadAlreadyConvertedError,
  LeadNotFoundError,
  type LeadListItem,
  type LeadListResult,
} from '@/lib/services/crm-lead-service'
import {
  getRequestCompanyId,
  memberTenantScope,
} from '@/lib/tenancy/request-company'
import {
  assignLeadSchema,
  changeLeadStatusSchema,
  convertLeadSchema,
  createContactViewSchema,
  createLeadSchema,
  importLeadsSchema,
  leadFilterSchema,
  renameContactViewSchema,
  updateContactViewFilterSchema,
  updateLeadSchema,
  type CreateLeadInput,
  type ImportLeadsInput,
  type UpdateLeadInput,
} from '@/lib/validations/crm-lead'

// ============================================
// SHARED RESULT SHAPES
// ============================================

export interface MutationOk<T = void> {
  ok: true
  data: T
}
export interface MutationErr {
  ok: false
  error?: string
  fieldErrors?: Record<string, string[]>
}
export type MutationResult<T = void> = MutationOk<T> | MutationErr

function fieldErrorsFromZod(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root'
    if (!out[key]) out[key] = []
    out[key]!.push(issue.message)
  }
  return out
}

function toMutationErr(err: unknown, fallback: string): MutationErr {
  if (err instanceof LeadNotFoundError) return { ok: false, error: err.message }
  if (err instanceof LeadAlreadyConvertedError) {
    return { ok: false, error: err.message }
  }
  if (err instanceof ContactViewNotFoundError) {
    return { ok: false, error: err.message }
  }
  console.error('[crm/leads/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

function revalidateAll(): void {
  revalidatePath('/admin/crm/leads')
  revalidatePath('/team/crm/leads')
  // Conversions add a pipeline card — keep the board fresh too.
  revalidatePath('/admin/crm/opportunities')
  revalidatePath('/team/crm/opportunities')
}

// ============================================
// WORKSPACE FETCHER
// ============================================

export interface CrmTeamMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export interface LeadsWorkspacePayload {
  leads: LeadListResult
  members: CrmTeamMember[]
  currentUserId: string
  companyId: string | null
  /** Owner-scoped saved views (GHL "Smart Lists"). Empty on
   *  tenants/users that haven't saved any. */
  views: ContactViewRow[]
}

export async function fetchLeadsWorkspaceAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<LeadsWorkspacePayload>> {
  const currentUser = await requireTeamModuleAccess('crm-leads')
  const companyId = await getRequestCompanyId()

  // Team surface "only mine" → fold the viewer into assigneeIds.
  const mine = filters.mine === true
  const cleaned: Record<string, unknown> = { ...filters }
  delete cleaned.mine
  if (mine) {
    const existing = Array.isArray(cleaned.assigneeIds)
      ? (cleaned.assigneeIds as string[])
      : []
    cleaned.assigneeIds = Array.from(new Set([...existing, currentUser.id]))
  }

  const parsed = leadFilterSchema.safeParse(cleaned)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const tenantScope = await memberTenantScope()
    const [leads, members, views] = await Promise.all([
      crmLeadService.list(parsed.data),
      // Same rule as opportunities' Assigned to picker — narrow to
      // users with a setter/closer role, fall back to all ADMIN/TEAM.
      listAssignableSalesUsers(tenantScope),
      crmContactViewService.list(currentUser.id),
    ])

    return {
      ok: true,
      data: {
        leads,
        members,
        currentUserId: currentUser.id,
        companyId,
        views,
      },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load leads')
  }
}

// ============================================
// MUTATIONS
// ============================================

export async function createLeadAction(
  input: CreateLeadInput,
): Promise<MutationResult<LeadListItem>> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = createLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmLeadService.create(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not create lead')
  }
}

/** Live dedupe probe for the create form — returns leads that share
 *  the typed email/phone so the operator can bail before double-
 *  entering a prospect. */
export async function checkLeadDuplicatesAction(input: {
  email?: string | null
  phone?: string | null
}): Promise<MutationResult<LeadListItem[]>> {
  await requireTeamModuleAccess('crm-leads')
  try {
    const data = await crmLeadService.findPotentialDuplicates(input)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not check duplicates')
  }
}

export async function updateLeadAction(
  id: string,
  input: UpdateLeadInput,
): Promise<MutationResult<LeadListItem>> {
  await requireTeamModuleAccess('crm-leads')
  const parsed = updateLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmLeadService.update(id, parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not update lead')
  }
}

export async function changeLeadStatusAction(
  input: Record<string, unknown>,
): Promise<MutationResult<LeadListItem>> {
  await requireTeamModuleAccess('crm-leads')
  const parsed = changeLeadStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmLeadService.changeStatus(
      parsed.data.leadId,
      parsed.data.status,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not change status')
  }
}

export async function assignLeadAction(
  input: Record<string, unknown>,
): Promise<MutationResult<LeadListItem>> {
  await requireTeamModuleAccess('crm-leads')
  const parsed = assignLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmLeadService.assignSetter(
      parsed.data.leadId,
      parsed.data.setterId,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not assign lead')
  }
}

export async function convertLeadAction(
  input: Record<string, unknown>,
): Promise<MutationResult<{ opportunityId: string }>> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = convertLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmLeadService.convertToOpportunity(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not convert lead')
  }
}

export async function importLeadsAction(
  input: ImportLeadsInput,
): Promise<
  MutationResult<{
    created: number
    updated: number
    skipped: number
    jobId: string
  }>
> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = importLeadsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  // Log the run before we start so a crash mid-insert still leaves a
  // RUNNING row for the operator to see + retry from history.
  const job = await crmImportJobService.start({
    object: 'CONTACTS',
    mode: parsed.data.mode,
    rowsTotal: parsed.data.rows.length,
    fileName: parsed.data.fileName ?? null,
    fileSize: parsed.data.fileSize ?? null,
    params: { assignedSetterId: parsed.data.assignedSetterId ?? null },
    actorId: user.id,
  })

  try {
    const data = await crmLeadService.importCsv(
      parsed.data,
      user.id,
      parsed.data.mode,
    )
    await crmImportJobService.complete({
      jobId: job.id,
      rowsCreated: data.created,
      rowsUpdated: data.updated,
      rowsSkipped: data.skipped,
      rowsFailed: 0,
    })
    revalidateAll()
    return { ok: true, data: { ...data, jobId: job.id } }
  } catch (err) {
    await crmImportJobService.fail({
      jobId: job.id,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return toMutationErr(err, 'Could not import leads')
  }
}

export async function deleteLeadAction(
  id: string,
): Promise<MutationResult> {
  await requireTeamModuleAccess('crm-leads')
  try {
    await crmLeadService.softDelete(id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete lead')
  }
}

// ============================================
// SMART LISTS  (saved views on the Contacts inbox)
// ============================================

export async function fetchContactViewsAction(): Promise<
  MutationResult<ContactViewRow[]>
> {
  const user = await requireTeamModuleAccess('crm-leads')
  try {
    const data = await crmContactViewService.list(user.id)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load smart lists')
  }
}

export async function createContactViewAction(
  input: Record<string, unknown>,
): Promise<MutationResult<ContactViewRow>> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = createContactViewSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await crmContactViewService.create({
      name: parsed.data.name,
      // Zod validated the shape; Prisma's InputJsonValue is a nominal
      // type that objects with a permissive index signature don't
      // structurally match, so we cast at the boundary.
      filter: parsed.data.filter as unknown as Prisma.InputJsonValue,
      ownerId: user.id,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not save smart list')
  }
}

export async function renameContactViewAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = renameContactViewSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    await crmContactViewService.rename({
      viewId: parsed.data.viewId,
      name: parsed.data.name,
      ownerId: user.id,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not rename smart list')
  }
}

export async function updateContactViewFilterAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = updateContactViewFilterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    await crmContactViewService.updateFilter({
      viewId: parsed.data.viewId,
      filter: parsed.data.filter as unknown as Prisma.InputJsonValue,
      ownerId: user.id,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not update smart list')
  }
}

export async function deleteContactViewAction(
  viewId: string,
): Promise<MutationResult> {
  const user = await requireTeamModuleAccess('crm-leads')
  try {
    await crmContactViewService.delete({ viewId, ownerId: user.id })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete smart list')
  }
}
