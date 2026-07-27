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
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

export class StageInUseError extends Error {
  constructor(message = 'Cannot delete a stage that still holds deals') {
    super(message)
    this.name = 'StageInUseError'
  }
}

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
        isDefault: true,
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
  isDefault: boolean
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

class CrmPipelineService {
  /** Every pipeline for the tenant, default first. */
  async listPipelines(): Promise<PipelineSummary[]> {
    const rows = await prisma.crmPipeline.findMany({
      orderBy: [{ isDefault: 'desc' }, { orderIndex: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isDefault: true,
        orderIndex: true,
      },
    })
    return rows
  }

  /** Resolve the pipeline to show: an explicit id, else the default,
   *  else the first one. Returns null when the tenant has none. */
  async resolvePipelineId(preferredId?: string): Promise<string | null> {
    if (preferredId) {
      const found = await prisma.crmPipeline.findFirst({
        where: { id: preferredId },
        select: { id: true },
      })
      if (found) return found.id
    }
    const fallback = await prisma.crmPipeline.findFirst({
      orderBy: [{ isDefault: 'desc' }, { orderIndex: 'asc' }],
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
}

export const crmPipelineService = new CrmPipelineService()
