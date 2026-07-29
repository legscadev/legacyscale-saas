'use server'

// Server actions for the CRM Leads module (P0 #2). Thin controllers:
// auth (crm-leads module) → Zod parse → service → revalidate →
// {ok,...}. Same shape as the pipeline + task-tracker actions.

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
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
  createLeadSchema,
  importLeadsSchema,
  leadFilterSchema,
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
    const [leads, members] = await Promise.all([
      crmLeadService.list(parsed.data),
      prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          role: { in: ['ADMIN', 'TEAM'] },
          ...tenantScope,
        },
        select: { id: true, name: true, email: true, avatarUrl: true },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
      }),
    ])

    return {
      ok: true,
      data: { leads, members, currentUserId: currentUser.id, companyId },
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
): Promise<MutationResult<{ created: number }>> {
  const user = await requireTeamModuleAccess('crm-leads')
  const parsed = importLeadsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmLeadService.importCsv(parsed.data, user.id)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
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
