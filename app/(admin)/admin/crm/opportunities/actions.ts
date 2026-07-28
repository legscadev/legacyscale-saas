'use server'

// Server actions for the CRM sales pipeline (P0 #1). Every action is
// a thin controller: auth check → parse with Zod → hand off to a
// service → revalidate → return {ok, ...} or {ok:false, error,
// fieldErrors}. Same shape + conventions as the Task Tracker actions.

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import {
  crmBulkActionService,
  type BulkActionListFilters,
  type BulkActionLogRow,
} from '@/lib/services/crm-bulk-action-service'
import {
  crmOpportunityService,
  OpportunityNotFoundError,
  StageNotFoundError,
  type OpportunityListItem,
} from '@/lib/services/crm-opportunity-service'
import {
  crmPipelineService,
  ensurePipelineReady,
  LastPipelineError,
  PipelineInUseError,
  PipelineNotFoundError,
  StageInUseError,
  StageNotFoundError as PipelineStageNotFoundError,
  type PipelineListRow,
  type PipelineStage,
  type PipelineSummary,
} from '@/lib/services/crm-pipeline-service'
import {
  getRequestCompanyId,
  memberTenantScope,
} from '@/lib/tenancy/request-company'
import {
  addStageSchema,
  bulkActionHistoryFilterSchema,
  bulkAssignCloserSchema,
  bulkDeleteOpportunitiesSchema,
  bulkMoveOpportunitiesSchema,
  createOpportunitySchema,
  createPipelineSchema,
  moveOpportunitySchema,
  opportunityFilterSchema,
  renamePipelineSchema,
  reorderPipelinesSchema,
  reorderStagesSchema,
  updateOpportunitySchema,
  updateStageSchema,
  type AddStageInput,
  type CreateOpportunityInput,
  type CreatePipelineInput,
  type UpdateOpportunityInput,
  type UpdateStageInput,
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
    err instanceof StageNotFoundError ||
    err instanceof PipelineStageNotFoundError ||
    err instanceof PipelineNotFoundError ||
    err instanceof LastPipelineError ||
    err instanceof PipelineInUseError ||
    err instanceof StageInUseError
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

/** Full detail for the edit-card dialog (includes fields the board
 *  list omits — email, phone, notes, pipelineId). */
export async function fetchOpportunityAction(id: string): Promise<
  MutationResult<
    OpportunityListItem & {
      contactEmail: string | null
      contactPhone: string | null
      notes: string | null
      pipelineId: string
    }
  >
> {
  await requireTeamModuleAccess('crm-pipeline')
  try {
    const data = await crmOpportunityService.get(id)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load deal')
  }
}

// ============================================
// PIPELINE MANAGEMENT
// ============================================

export async function createPipelineAction(
  input: CreatePipelineInput,
): Promise<MutationResult<PipelineSummary>> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = createPipelineSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await crmPipelineService.createPipeline(parsed.data)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not create pipeline')
  }
}

export async function renamePipelineAction(
  input: Record<string, unknown>,
): Promise<MutationResult<PipelineSummary>> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = renamePipelineSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const data = await crmPipelineService.renamePipeline(
      parsed.data.pipelineId,
      parsed.data.name,
    )
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not rename pipeline')
  }
}

export async function deletePipelineAction(
  id: string,
): Promise<MutationResult> {
  await requireTeamModuleAccess('crm-pipeline')
  try {
    await crmPipelineService.deletePipeline(id)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete pipeline')
  }
}

/** Powers the /pipelines management table. Returns every pipeline with
 *  its stage + open-deal counts and last-updated timestamp. */
export async function fetchPipelinesForManagementAction(): Promise<
  MutationResult<PipelineListRow[]>
> {
  await requireTeamModuleAccess('crm-pipeline')
  try {
    const companyId = await getRequestCompanyId()
    if (companyId) await ensurePipelineReady(companyId)
    const data = await crmPipelineService.listPipelinesWithMeta()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load pipelines')
  }
}

export async function reorderPipelinesAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = reorderPipelinesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    await crmPipelineService.reorderPipelines(parsed.data.pipelineIds)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not reorder pipelines')
  }
}

// ============================================
// STAGE EDITOR
// ============================================

export type StageWithCount = PipelineStage & { dealCount: number }

export async function fetchPipelineStagesAction(
  pipelineId: string,
): Promise<MutationResult<StageWithCount[]>> {
  await requireTeamModuleAccess('crm-pipeline')
  try {
    const data = await crmPipelineService.listStagesWithCounts(pipelineId)
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not load stages')
  }
}

export async function addStageAction(
  input: AddStageInput,
): Promise<MutationResult<PipelineStage>> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = addStageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const { pipelineId, ...rest } = parsed.data
    const data = await crmPipelineService.addStage(pipelineId, rest)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not add stage')
  }
}

export async function updateStageAction(
  input: UpdateStageInput,
): Promise<MutationResult<PipelineStage>> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = updateStageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const { stageId, ...rest } = parsed.data
    const data = await crmPipelineService.updateStage(stageId, rest)
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toMutationErr(err, 'Could not update stage')
  }
}

export async function reorderStagesAction(
  input: Record<string, unknown>,
): Promise<MutationResult> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = reorderStagesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    await crmPipelineService.reorderStages(
      parsed.data.pipelineId,
      parsed.data.stageIds,
    )
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not reorder stages')
  }
}

export async function deleteStageAction(
  stageId: string,
): Promise<MutationResult> {
  await requireTeamModuleAccess('crm-pipeline')
  try {
    await crmPipelineService.deleteStage(stageId)
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toMutationErr(err, 'Could not delete stage')
  }
}

// ============================================
// BULK ACTIONS
// ============================================

/** Soft-deletes a list of opportunities and returns the persisted
 *  log row (so the toolbar toast can show target/success counts and
 *  the history page can render it without a refetch). */
export async function bulkDeleteOpportunitiesAction(
  input: Record<string, unknown>,
): Promise<MutationResult<BulkActionLogRow>> {
  const user = await requireTeamModuleAccess('crm-pipeline')
  const parsed = bulkDeleteOpportunitiesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const log = await crmBulkActionService.bulkDeleteOpportunities({
      opportunityIds: parsed.data.opportunityIds,
      actorId: user.id,
    })
    revalidateAll()
    revalidatePath('/admin/crm/opportunities/bulk-actions')
    revalidatePath('/team/crm/opportunities/bulk-actions')
    return { ok: true, data: log }
  } catch (err) {
    return toMutationErr(err, 'Could not delete deals')
  }
}

/** Bulk move-to-stage. Same shape + logging as bulkDelete. */
export async function bulkMoveOpportunitiesToStageAction(
  input: Record<string, unknown>,
): Promise<MutationResult<BulkActionLogRow>> {
  const user = await requireTeamModuleAccess('crm-pipeline')
  const parsed = bulkMoveOpportunitiesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const log = await crmBulkActionService.bulkMoveOpportunitiesToStage({
      opportunityIds: parsed.data.opportunityIds,
      stageId: parsed.data.stageId,
      actorId: user.id,
    })
    revalidateAll()
    revalidatePath('/admin/crm/opportunities/bulk-actions')
    revalidatePath('/team/crm/opportunities/bulk-actions')
    return { ok: true, data: log }
  } catch (err) {
    return toMutationErr(err, 'Could not move deals')
  }
}

/** Bulk assign-closer. Pass closerId=null to unassign. */
export async function bulkAssignCloserAction(
  input: Record<string, unknown>,
): Promise<MutationResult<BulkActionLogRow>> {
  const user = await requireTeamModuleAccess('crm-pipeline')
  const parsed = bulkAssignCloserSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const log = await crmBulkActionService.bulkAssignCloser({
      opportunityIds: parsed.data.opportunityIds,
      closerId: parsed.data.closerId,
      actorId: user.id,
    })
    revalidateAll()
    revalidatePath('/admin/crm/opportunities/bulk-actions')
    revalidatePath('/team/crm/opportunities/bulk-actions')
    return { ok: true, data: log }
  } catch (err) {
    return toMutationErr(err, 'Could not assign closer')
  }
}

/** Powers the /bulk-actions history table. */
export async function fetchBulkActionsHistoryAction(
  input: Record<string, unknown> = {},
): Promise<
  MutationResult<{ rows: BulkActionLogRow[]; total: number; page: number; limit: number }>
> {
  await requireTeamModuleAccess('crm-pipeline')
  const parsed = bulkActionHistoryFilterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }
  try {
    const filters: BulkActionListFilters = parsed.data
    const { rows, total } = await crmBulkActionService.list(filters)
    return {
      ok: true,
      data: { rows, total, page: parsed.data.page, limit: parsed.data.limit },
    }
  } catch (err) {
    return toMutationErr(err, 'Could not load bulk action history')
  }
}
