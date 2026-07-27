'use server'

// Server actions for the CRM sales pipeline (P0 #1). Every action is
// a thin controller: auth check → parse with Zod → hand off to a
// service → revalidate → return {ok, ...} or {ok:false, error,
// fieldErrors}. Same shape + conventions as the Task Tracker actions.

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import {
  crmOpportunityService,
  OpportunityNotFoundError,
  StageNotFoundError,
  type OpportunityListItem,
} from '@/lib/services/crm-opportunity-service'
import {
  crmPipelineService,
  ensurePipelineReady,
  type PipelineStage,
  type PipelineSummary,
} from '@/lib/services/crm-pipeline-service'
import {
  getRequestCompanyId,
  memberTenantScope,
} from '@/lib/tenancy/request-company'
import {
  createOpportunitySchema,
  moveOpportunitySchema,
  opportunityFilterSchema,
  updateOpportunitySchema,
  type CreateOpportunityInput,
  type UpdateOpportunityInput,
} from '@/lib/validations/crm'

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
  if (
    err instanceof OpportunityNotFoundError ||
    err instanceof StageNotFoundError
  ) {
    return { ok: false, error: err.message }
  }
  console.error('[crm/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

/** Revalidate both surfaces so an admin edit shows on the team board
 *  and vice-versa. */
function revalidateAll(): void {
  revalidatePath('/admin/crm/pipeline')
  revalidatePath('/team/crm/pipeline')
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

export interface PipelineWorkspacePayload {
  pipelines: PipelineSummary[]
  currentPipelineId: string | null
  stages: PipelineStage[]
  opportunities: OpportunityListItem[]
  members: CrmTeamMember[]
  currentUserId: string
  companyId: string | null
}

/** Sole entry point for the pipeline board's first render. */
export async function fetchPipelineWorkspaceAction(
  filters: Record<string, unknown> = {},
): Promise<MutationResult<PipelineWorkspacePayload>> {
  const currentUser = await requireTeamModuleAccess('crm-pipeline')
  const companyId = await getRequestCompanyId()
  if (companyId) await ensurePipelineReady(companyId)

  // "Only mine" (team surface) → fold the viewer into assigneeIds so
  // the board shows only their deals. Strip the key before schema
  // parse (the filter schema handles `mine` itself, but we resolve
  // the id here where the user is known).
  const mine = filters.mine === true
  const cleaned: Record<string, unknown> = { ...filters }
  delete cleaned.mine
  if (mine) {
    const existing = Array.isArray(cleaned.assigneeIds)
      ? (cleaned.assigneeIds as string[])
      : []
    cleaned.assigneeIds = Array.from(new Set([...existing, currentUser.id]))
  }

  const parsed = opportunityFilterSchema.safeParse(cleaned)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const pipelineId = await crmPipelineService.resolvePipelineId(
      parsed.data.pipelineId,
    )
    if (!pipelineId) {
      // No pipeline at all (seed failed / no active company) — return
      // an empty-but-valid payload so the board renders its empty state.
      return {
        ok: true,
        data: {
          pipelines: [],
          currentPipelineId: null,
          stages: [],
          opportunities: [],
          members: [],
          currentUserId: currentUser.id,
          companyId,
        },
      }
    }

    const tenantScope = await memberTenantScope()
    const [pipelines, stages, opportunities, members] = await Promise.all([
      crmPipelineService.listPipelines(),
      crmPipelineService.listStages(pipelineId),
      crmOpportunityService.list(pipelineId, parsed.data),
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
      data: {
        pipelines,
        currentPipelineId: pipelineId,
        stages,
        opportunities,
        members,
        currentUserId: currentUser.id,
        companyId,
      },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load pipeline')
  }
}

// ============================================
// MUTATIONS
// ============================================

export async function createOpportunityAction(
  pipelineId: string,
  input: CreateOpportunityInput,
): Promise<MutationResult<OpportunityListItem>> {
  const user = await requireTeamModuleAccess('crm-pipeline')
  const parsed = createOpportunitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const companyId = await getRequestCompanyId()
    if (companyId) await ensurePipelineReady(companyId)
    // Trust the resolved pipeline over the client-sent id so a stale
    // board can't write into a pipeline the tenant no longer has.
    const resolved = await crmPipelineService.resolvePipelineId(pipelineId)
    if (!resolved) return { ok: false, error: 'No pipeline available' }

    const data = await crmOpportunityService.create(
      resolved,
      parsed.data,
      user.id,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not create deal')
  }
}

export async function moveOpportunityAction(
  input: Record<string, unknown>,
): Promise<MutationResult<OpportunityListItem>> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = moveOpportunitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmOpportunityService.changeStage(
      parsed.data.opportunityId,
      parsed.data.stageId,
      parsed.data.orderIndex,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not move deal')
  }
}

export async function updateOpportunityAction(
  id: string,
  input: UpdateOpportunityInput,
): Promise<MutationResult<OpportunityListItem>> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = updateOpportunitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const data = await crmOpportunityService.update(id, parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not update deal')
  }
}

export async function deleteOpportunityAction(
  id: string,
): Promise<MutationResult> {
  await requireTeamModuleAccess('crm-pipeline')
  try {
    await crmOpportunityService.softDelete(id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete deal')
  }
}
