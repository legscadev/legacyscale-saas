// Per-tenant pipeline bootstrap + read helpers for the CRM board.
//
// Every tenant needs a pipeline with at least one stage before an
// opportunity can be created — the FK on crm_opportunities.stage_id
// is Restrict, not SetNull. This service seeds a GoHighLevel-style
// default pipeline (New Lead → … → Won / Lost) the first time a
// tenant opens the CRM.
//
// Idempotent: the seed short-circuits if any CrmPipeline row already
// exists for the tenant. Runs inside runAsSuperAdmin so the tenancy
// extension steps out of the way while we cross-check + insert on
// behalf of whichever tenant is active (mirrors task-workflow-service).

import { prisma } from '@/lib/prisma'
import {
  getRequestCompanyId,
  runAsSuperAdmin,
} from '@/lib/tenancy/request-company'

export class StageInUseError extends Error {
  constructor(message = 'Cannot delete a stage that still holds deals') {
    super(message)
    this.name = 'StageInUseError'
  }
}

export class LastPipelineError extends Error {
  constructor(message = 'A tenant must keep at least one pipeline') {
    super(message)
    this.name = 'LastPipelineError'
  }
}

export class PipelineInUseError extends Error {
  constructor(message = 'Cannot delete a pipeline that still holds deals') {
    super(message)
    this.name = 'PipelineInUseError'
  }
}

export class PipelineNotFoundError extends Error {
  constructor(message = 'Pipeline not found') {
    super(message)
    this.name = 'PipelineNotFoundError'
  }
}

export class StageNotFoundError extends Error {
  constructor(message = 'Stage not found') {
    super(message)
    this.name = 'StageNotFoundError'
  }
}

/** Column selection for a PipelineStage row. */
const STAGE_SELECT = {
  id: true,
  pipelineId: true,
  name: true,
  slug: true,
  color: true,
  orderIndex: true,
  probability: true,
  isWon: true,
  isLost: true,
  wipLimit: true,
} as const

/** The default pipeline every tenant gets on first CRM visit. */
const DEFAULT_PIPELINE = { name: 'Sales Pipeline', slug: 'sales' } as const

/**
 * The nine GoHighLevel-style default stages. Ordered by orderIndex;
 * `probability` seeds the win-likelihood a deal inherits when it
 * lands in the stage; the last two are terminal (isWon / isLost).
 * Admins rename / reorder / add stages later without touching code.
 */
const DEFAULT_STAGES = [
  { name: 'New Lead',              slug: 'new-lead',      color: '#64748b', orderIndex: 0, probability: 10,  isWon: false, isLost: false },
  { name: 'Contacted',            slug: 'contacted',     color: '#3b82f6', orderIndex: 1, probability: 20,  isWon: false, isLost: false },
  { name: 'Qualified',            slug: 'qualified',     color: '#0ea5e9', orderIndex: 2, probability: 35,  isWon: false, isLost: false },
  { name: 'Appointment Scheduled',slug: 'appointment',   color: '#8b5cf6', orderIndex: 3, probability: 50,  isWon: false, isLost: false },
  { name: 'Presentation',         slug: 'presentation',  color: '#a855f7', orderIndex: 4, probability: 60,  isWon: false, isLost: false },
  { name: 'Proposal Sent',        slug: 'proposal',      color: '#f59e0b', orderIndex: 5, probability: 70,  isWon: false, isLost: false },
  { name: 'Negotiation',          slug: 'negotiation',   color: '#ec4899', orderIndex: 6, probability: 85,  isWon: false, isLost: false },
  { name: 'Won',                  slug: 'won',           color: '#22c55e', orderIndex: 7, probability: 100, isWon: true,  isLost: false },
  { name: 'Lost',                 slug: 'lost',          color: '#ef4444', orderIndex: 8, probability: 0,   isWon: false, isLost: true  },
] as const

/** Default stage names — surfaced to the create-pipeline dialog so a
 *  new pipeline pre-fills with the standard stages (editable). */
export const DEFAULT_STAGE_NAMES: readonly string[] = DEFAULT_STAGES.map(
  (s) => s.name,
)

/** Colour palette cycled across a custom pipeline's stages. */
const STAGE_PALETTE = [
  '#64748b', '#3b82f6', '#0ea5e9', '#8b5cf6', '#a855f7',
  '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
]

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export interface PipelineSeedResult {
  pipelinesCreated: number
  stagesCreated: number
}

/**
 * Seed the default pipeline + stages for the given tenant if none
 * exist yet. Safe to re-run: a tenant that already has a pipeline is
 * left untouched.
 */
export async function seedDefaultPipeline(
  companyId: string,
): Promise<PipelineSeedResult> {
  return runAsSuperAdmin(async () => {
    const existing = await prisma.crmPipeline.count({ where: { companyId } })
    if (existing > 0) return { pipelinesCreated: 0, stagesCreated: 0 }

    await prisma.crmPipeline.create({
      data: {
        name: DEFAULT_PIPELINE.name,
        slug: DEFAULT_PIPELINE.slug,
        orderIndex: 0,
        companyId,
        stages: {
          create: DEFAULT_STAGES.map((s) => ({ ...s, companyId })),
        },
      },
    })
    return { pipelinesCreated: 1, stagesCreated: DEFAULT_STAGES.length }
  })
}

/**
 * Lazy-seed guard for the board's entry pages. Called from the
 * workspace fetcher — if the tenant has zero pipelines, seed before
 * the board renders so the operator never sees an empty screen on
 * first visit. No-op when the pipeline already exists.
 */
export async function ensurePipelineReady(companyId: string): Promise<void> {
  const existing = await runAsSuperAdmin(() =>
    prisma.crmPipeline.count({ where: { companyId } }),
  )
  if (existing > 0) return
  await seedDefaultPipeline(companyId)
}

// ============================================
// READ HELPERS
// ============================================

export interface PipelineSummary {
  id: string
  name: string
  slug: string
  orderIndex: number
}

/** One board column. Mirrors the tasks WorkflowStatus shape so the
 *  Kanban component can be reused almost verbatim. */
export interface PipelineStage {
  id: string
  pipelineId: string
  name: string
  slug: string
  color: string
  orderIndex: number
  probability: number | null
  isWon: boolean
  isLost: boolean
  wipLimit: number | null
}

/** Row shape for the /pipelines management table. */
export interface PipelineListRow extends PipelineSummary {
  stageCount: number
  dealCount: number
  updatedAt: Date
}

class CrmPipelineService {
  /** Every pipeline for the tenant, ordered by user-defined
   *  orderIndex. */
  async listPipelines(): Promise<PipelineSummary[]> {
    const rows = await prisma.crmPipeline.findMany({
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        orderIndex: true,
      },
    })
    return rows
  }

  /** Pipelines + per-pipeline stage and (non-deleted) deal counts —
   *  powers the /pipelines management table. */
  async listPipelinesWithMeta(): Promise<PipelineListRow[]> {
    const rows = await prisma.crmPipeline.findMany({
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        orderIndex: true,
        updatedAt: true,
        _count: {
          select: {
            stages: true,
            opportunities: { where: { deletedAt: null } },
          },
        },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      orderIndex: r.orderIndex,
      updatedAt: r.updatedAt,
      stageCount: r._count.stages,
      dealCount: r._count.opportunities,
    }))
  }

  /** Rewrite orderIndex for every pipeline in the tenant from the given
   *  ordered id array (drag-drop reorder in the management table).
   *  Any id not listed keeps its existing orderIndex. */
  async reorderPipelines(pipelineIds: string[]): Promise<void> {
    if (pipelineIds.length === 0) return
    await prisma.$transaction(
      pipelineIds.map((id, index) =>
        prisma.crmPipeline.update({
          where: { id },
          data: { orderIndex: index },
        }),
      ),
    )
  }

  /** Resolve the pipeline to show: an explicit id, else the one with
   *  the lowest orderIndex. Returns null when the tenant has none. */
  async resolvePipelineId(preferredId?: string): Promise<string | null> {
    if (preferredId) {
      const found = await prisma.crmPipeline.findFirst({
        where: { id: preferredId },
        select: { id: true },
      })
      if (found) return found.id
    }
    const fallback = await prisma.crmPipeline.findFirst({
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    })
    return fallback?.id ?? null
  }

  /** Ordered stages (Kanban columns) for one pipeline. */
  async listStages(pipelineId: string): Promise<PipelineStage[]> {
    const rows = await prisma.crmPipelineStage.findMany({
      where: { pipelineId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        pipelineId: true,
        name: true,
        slug: true,
        color: true,
        orderIndex: true,
        probability: true,
        isWon: true,
        isLost: true,
        wipLimit: true,
      },
    })
    return rows
  }

  /**
   * Create a new pipeline with the given stages. Slug is derived from
   * the name and made unique per tenant. Stage colours cycle the
   * palette; a stage named "won"/"lost" (case-insensitive) is flagged
   * terminal so the board's WON/LOST logic still works. companyId is
   * stamped explicitly on the nested stage rows (the tenancy extension
   * only auto-stamps top-level writes).
   */
  async createPipeline(input: {
    name: string
    stageNames: string[]
  }): Promise<PipelineSummary> {
    const companyId = await requireCompanyId()
    const names = input.stageNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
    if (names.length === 0) {
      throw new Error('A pipeline needs at least one stage')
    }

    const slug = await this.uniqueSlug(companyId, slugify(input.name) || 'pipeline')

    const lastOrder = await prisma.crmPipeline.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })

    const created = await prisma.crmPipeline.create({
      data: {
        name: input.name.trim(),
        slug,
        orderIndex: (lastOrder?.orderIndex ?? -1) + 1,
        companyId,
        stages: {
          create: names.map((name, i) => {
            const lower = name.toLowerCase()
            return {
              name,
              slug: slugify(name) || `stage-${i + 1}`,
              color: STAGE_PALETTE[i % STAGE_PALETTE.length]!,
              orderIndex: i,
              isWon: lower === 'won',
              isLost: lower === 'lost',
              probability: lower === 'won' ? 100 : lower === 'lost' ? 0 : null,
              companyId,
            }
          }),
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        orderIndex: true,
      },
    })
    return created
  }

  /**
   * Clone a pipeline together with its stages (colours, probability,
   * won/lost flags — but no deals). Returns the newly created
   * pipeline. Slug is derived from `name` with the usual per-tenant
   * uniqueness guard.
   */
  async duplicatePipeline(input: {
    sourcePipelineId: string
    name: string
  }): Promise<PipelineSummary> {
    const companyId = await requireCompanyId()
    const source = await prisma.crmPipeline.findFirst({
      where: { id: input.sourcePipelineId },
      select: {
        id: true,
        stages: {
          orderBy: { orderIndex: 'asc' },
          select: {
            name: true,
            slug: true,
            color: true,
            orderIndex: true,
            probability: true,
            isWon: true,
            isLost: true,
            wipLimit: true,
          },
        },
      },
    })
    if (!source) throw new PipelineNotFoundError()

    const cleanName = input.name.trim()
    const slug = await this.uniqueSlug(
      companyId,
      slugify(cleanName) || 'pipeline',
    )
    const lastOrder = await prisma.crmPipeline.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })

    // Nested stage create — stage slugs are unique-per-pipeline, so
    // copying the source slugs verbatim is safe (they live under the
    // new pipeline id).
    const created = await prisma.crmPipeline.create({
      data: {
        name: cleanName,
        slug,
        orderIndex: (lastOrder?.orderIndex ?? -1) + 1,
        companyId,
        stages: {
          create: source.stages.map((s) => ({ ...s, companyId })),
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        orderIndex: true,
      },
    })
    return created
  }

  async renamePipeline(id: string, name: string): Promise<PipelineSummary> {
    await this.assertPipelineExists(id)
    const row = await prisma.crmPipeline.update({
      where: { id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        slug: true,
        orderIndex: true,
      },
    })
    return row
  }

  /**
   * Delete a pipeline. Blocked when it's the tenant's last one or
   * still holds (non-deleted) deals — the FK cascade would wipe those
   * deals, so we force the operator to move/close them first.
   */
  async deletePipeline(id: string): Promise<void> {
    const [pipeline, total] = await Promise.all([
      prisma.crmPipeline.findFirst({
        where: { id },
        select: { id: true },
      }),
      prisma.crmPipeline.count(),
    ])
    if (!pipeline) throw new PipelineNotFoundError()
    if (total <= 1) throw new LastPipelineError()

    const dealCount = await prisma.crmOpportunity.count({
      where: { pipelineId: id, deletedAt: null },
    })
    if (dealCount > 0) throw new PipelineInUseError()

    await prisma.crmPipeline.delete({ where: { id } })
  }

  // ============================================
  // STAGE EDITOR
  // ============================================

  /** Stages for a pipeline with each stage's open-deal count — powers
   *  the manage-stages editor + its delete guard. */
  async listStagesWithCounts(
    pipelineId: string,
  ): Promise<Array<PipelineStage & { dealCount: number }>> {
    const rows = await prisma.crmPipelineStage.findMany({
      where: { pipelineId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        pipelineId: true,
        name: true,
        slug: true,
        color: true,
        orderIndex: true,
        probability: true,
        isWon: true,
        isLost: true,
        wipLimit: true,
        _count: {
          select: { opportunities: { where: { deletedAt: null } } },
        },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      pipelineId: r.pipelineId,
      name: r.name,
      slug: r.slug,
      color: r.color,
      orderIndex: r.orderIndex,
      probability: r.probability,
      isWon: r.isWon,
      isLost: r.isLost,
      wipLimit: r.wipLimit,
      dealCount: r._count.opportunities,
    }))
  }

  /** Append a new stage to the end of a pipeline. */
  async addStage(
    pipelineId: string,
    input: {
      name: string
      color?: string
      probability?: number | null
      isWon?: boolean
      isLost?: boolean
    },
  ): Promise<PipelineStage> {
    const companyId = await requireCompanyId()
    await this.assertPipelineExists(pipelineId)

    const [last, count] = await Promise.all([
      prisma.crmPipelineStage.findFirst({
        where: { pipelineId },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      }),
      prisma.crmPipelineStage.count({ where: { pipelineId } }),
    ])
    const slug = await this.uniqueStageSlug(
      pipelineId,
      slugify(input.name) || `stage-${count + 1}`,
    )

    const row = await prisma.crmPipelineStage.create({
      data: {
        pipelineId,
        name: input.name.trim(),
        slug,
        color: input.color ?? STAGE_PALETTE[count % STAGE_PALETTE.length]!,
        orderIndex: (last?.orderIndex ?? -1) + 1,
        probability: input.probability ?? null,
        isWon: input.isWon ?? false,
        isLost: input.isLost ?? false,
        companyId,
      },
      select: STAGE_SELECT,
    })
    return row
  }

  /** Partial update of a stage's editable fields. */
  async updateStage(
    stageId: string,
    input: {
      name?: string
      color?: string
      probability?: number | null
      isWon?: boolean
      isLost?: boolean
      wipLimit?: number | null
    },
  ): Promise<PipelineStage> {
    const existing = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId },
      select: { id: true },
    })
    if (!existing) throw new StageNotFoundError()

    const row = await prisma.crmPipelineStage.update({
      where: { id: stageId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.isWon !== undefined ? { isWon: input.isWon } : {}),
        ...(input.isLost !== undefined ? { isLost: input.isLost } : {}),
        ...(input.wipLimit !== undefined ? { wipLimit: input.wipLimit } : {}),
      },
      select: STAGE_SELECT,
    })
    return row
  }

  /** Rewrite orderIndex for a pipeline's stages from an ordered id
   *  array (drag-drop reorder in the editor). */
  async reorderStages(pipelineId: string, stageIds: string[]): Promise<void> {
    await prisma.$transaction(
      stageIds.map((id, index) =>
        prisma.crmPipelineStage.update({
          where: { id },
          data: { orderIndex: index },
        }),
      ),
    )
  }

  /**
   * Delete a stage. Blocked when it still holds (non-deleted) deals
   * (the Restrict FK would throw anyway; we give a friendly error) or
   * when it's the pipeline's last stage.
   */
  async deleteStage(stageId: string): Promise<void> {
    const stage = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId },
      select: { id: true, pipelineId: true },
    })
    if (!stage) throw new StageNotFoundError()

    const [dealCount, stageCount] = await Promise.all([
      prisma.crmOpportunity.count({
        where: { stageId, deletedAt: null },
      }),
      prisma.crmPipelineStage.count({
        where: { pipelineId: stage.pipelineId },
      }),
    ])
    if (dealCount > 0) throw new StageInUseError()
    if (stageCount <= 1) {
      throw new StageInUseError('A pipeline must keep at least one stage')
    }
    // Soft-deleted opportunities still hold the (Restrict) stage FK, so
    // the stage delete would fail on them even though they're archived.
    // The guard above already blocked *active* deals; purge the
    // archived ones here so the stage can go.
    await prisma.crmOpportunity.deleteMany({
      where: { stageId, deletedAt: { not: null } },
    })
    await prisma.crmPipelineStage.delete({ where: { id: stageId } })
  }

  private async uniqueStageSlug(
    pipelineId: string,
    base: string,
  ): Promise<string> {
    let candidate = base
    let n = 2
    while (
      await prisma.crmPipelineStage.findFirst({
        where: { pipelineId, slug: candidate },
        select: { id: true },
      })
    ) {
      candidate = `${base}-${n++}`
    }
    return candidate
  }

  private async assertPipelineExists(id: string): Promise<void> {
    const row = await prisma.crmPipeline.findFirst({
      where: { id },
      select: { id: true },
    })
    if (!row) throw new PipelineNotFoundError()
  }

  /** Append -2, -3… until the slug is free within the tenant. */
  private async uniqueSlug(companyId: string, base: string): Promise<string> {
    let candidate = base
    let n = 2
    // The (companyId, slug) unique index is what we're avoiding.
    while (
      await prisma.crmPipeline.findFirst({
        where: { companyId, slug: candidate },
        select: { id: true },
      })
    ) {
      candidate = `${base}-${n++}`
    }
    return candidate
  }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('crm-pipeline-service: no active company')
  return id
}

export const crmPipelineService = new CrmPipelineService()
