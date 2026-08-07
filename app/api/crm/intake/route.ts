// Public webhook for external forms + landing-page funnels. POSTs
// spawn a Contact (crm_leads) + Opportunity in the tenant's default
// pipeline. Source-agnostic — the caller passes `source` on the
// payload so filters like source="100k Marketing Program" work on
// both the Contacts and Opportunities boards.
//
// Auth: shared secret in the `x-intake-token` header, checked
// against the CRM_INTAKE_TOKEN env var. Add per-source routing
// (custom pipeline, assignee, etc.) via a future Sources admin
// surface — for now every intake drops in the default pipeline's
// first stage.
//
// Tenant: PLATFORM_SEED_COMPANY_ID by default. Overridable via the
// CRM_INTAKE_COMPANY_ID env var if you point the endpoint at a
// non-primary tenant.

import { after, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { notifyLead } from '@/lib/services/lead-notify'
import { crmLeadService } from '@/lib/services/crm-lead-service'
import { crmPipelineService } from '@/lib/services/crm-pipeline-service'
import { PLATFORM_SEED_COMPANY_ID } from '@/lib/tenancy/seed'
import { runAsTenant } from '@/lib/tenancy/request-company'
import { leadIntakeSchema } from '@/lib/validations/crm-intake'

/** Never cache — a form POST always runs fresh. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Serialise the `answers` map into a human-readable block for the
 *  opportunity's description. Prettified so a closer can eyeball it
 *  without JSON parsing. */
function formatAnswers(answers: Record<string, unknown> | undefined): string {
  if (!answers) return ''
  const lines: string[] = []
  for (const [key, raw] of Object.entries(answers)) {
    if (raw === null || raw === undefined || raw === '') continue
    const value =
      typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
        ? String(raw)
        : JSON.stringify(raw)
    // Turn a snake/camel-case key into a readable label.
    const label = key
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^\w/, (c) => c.toUpperCase())
    lines.push(`${label}: ${value}`)
  }
  return lines.join('\n')
}

/** Append-mode write: enrich the contact's most recent opportunity
 *  instead of spawning a new deal. Used by follow-up form steps (e.g.
 *  an Instagram-handle capture on the success screen). Returns null
 *  when there's no matching contact or prior deal, so the caller can
 *  fall back to a normal create. Runs inside the tenant scope, so
 *  Prisma auto-filters by company. */
async function appendToLatestOpportunity(
  email: string,
  extraNotes: string,
): Promise<{ contactId: string; opportunityId: string; appended: true } | null> {
  if (!extraNotes) return null
  const contact = await prisma.crmLead.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (!contact) return null
  const opp = await prisma.crmOpportunity.findFirst({
    where: { contactId: contact.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, notes: true },
  })
  if (!opp) return null

  const merged = [opp.notes, extraNotes]
    .filter((s): s is string => !!s && s.length > 0)
    .join('\n\n')

  await prisma.crmOpportunity.update({
    where: { id: opp.id },
    data: { notes: merged || null },
  })
  await prisma.crmLead.update({
    where: { id: contact.id },
    data: { lastActivityAt: new Date() },
  })
  return { contactId: contact.id, opportunityId: opp.id, appended: true }
}

/** Find the partial deal to promote: an explicit id first (returned by
 *  the earlier `partial` write), else the contact's latest deal in this
 *  pipeline. Scoped by pipeline so a promote never grabs a deal from
 *  another funnel. Runs inside the tenant scope. */
async function findPromotable(
  pipelineId: string,
  opportunityId: string | undefined,
  email: string | undefined,
): Promise<{ id: string; contactId: string | null } | null> {
  if (opportunityId) {
    return prisma.crmOpportunity.findFirst({
      where: { id: opportunityId, pipelineId, deletedAt: null },
      select: { id: true, contactId: true },
    })
  }
  if (email) {
    return prisma.crmOpportunity.findFirst({
      where: {
        pipelineId,
        deletedAt: null,
        contactEmail: { equals: email, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, contactId: true },
    })
  }
  return null
}

/** Promote a partial deal into the target stage (New Lead) and enrich it
 *  with the completed application's notes — the applicant finished, so the
 *  same deal advances instead of spawning a duplicate. Returns null when
 *  there's no partial deal to promote, so the caller falls back to a
 *  normal create. Returns `pipelineId` so the caller fires the closer
 *  notification (now that we have full answers). */
async function promoteOpportunity(args: {
  pipelineId: string
  opportunityId?: string
  email?: string
  stageName?: string
  notes: string
  campaign?: string
}): Promise<{
  contactId: string | null
  opportunityId: string
  pipelineId: string
} | null> {
  const opp = await findPromotable(args.pipelineId, args.opportunityId, args.email)
  if (!opp) return null

  const stage = await crmPipelineService.resolveStageId(
    args.pipelineId,
    args.stageName,
  )
  if (!stage) return null

  await prisma.crmOpportunity.update({
    where: { id: opp.id },
    data: {
      stageId: stage.id,
      probability: stage.probability,
      notes: args.notes || null,
    },
  })
  if (opp.contactId) {
    await prisma.crmLead.update({
      where: { id: opp.contactId },
      data: {
        ...(args.campaign ? { campaign: args.campaign } : {}),
        lastActivityAt: new Date(),
      },
    })
  }
  return { contactId: opp.contactId, opportunityId: opp.id, pipelineId: args.pipelineId }
}

export async function POST(req: Request) {
  // ---- Auth ----------------------------------------------------
  const expected = process.env.CRM_INTAKE_TOKEN
  if (!expected) {
    console.error('[crm/intake] CRM_INTAKE_TOKEN env var is not set')
    return NextResponse.json(
      { ok: false, error: 'Intake endpoint is not configured' },
      { status: 500 },
    )
  }
  const supplied = req.headers.get('x-intake-token') ?? ''
  if (supplied !== expected) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  // ---- Body parse ---------------------------------------------
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }
  const parsed = leadIntakeSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }
  const input = parsed.data

  // ---- Write --------------------------------------------------
  const companyId =
    process.env.CRM_INTAKE_COMPANY_ID || PLATFORM_SEED_COMPANY_ID
  const source = input.source?.trim() || 'Landing page'

  const notes = [
    input.campaign ? `Campaign: ${input.campaign}` : null,
    formatAnswers(input.answers),
  ]
    .filter((s): s is string => !!s && s.length > 0)
    .join('\n\n')

  try {
    const result = await runAsTenant(companyId, async () => {
      // Append mode: enrich the person's existing deal (e.g. an
      // Instagram-handle capture on the success screen) rather than
      // spawning a duplicate. Falls through to create when there's no
      // prior opportunity to attach to.
      if (input.mode === 'append' && input.email) {
        const appended = await appendToLatestOpportunity(input.email, notes)
        if (appended) return appended
      }

      // Route by the funnel's pipeline id when supplied; unknown/omitted
      // ids fall back to the tenant's default pipeline.
      const pipelineId = await crmPipelineService.resolvePipelineId(
        input.pipeline,
      )
      if (!pipelineId) {
        throw new Error(
          'No pipeline configured — create one at /admin/crm/opportunities/pipelines first',
        )
      }

      // Promote mode: the applicant finished the form — advance their
      // partial deal into the target stage (New Lead) and enrich it with
      // the full answers. Falls through to a normal create when there's
      // no partial deal to promote.
      if (input.mode === 'promote') {
        const promoted = await promoteOpportunity({
          pipelineId,
          opportunityId: input.opportunityId,
          email: input.email,
          stageName: input.stage,
          notes,
          campaign: input.campaign,
        })
        if (promoted) return promoted
      }

      // Dedupe contact by email (falls back to name+company when
      // no email); P0 #3's find-or-create writes back the source
      // + lastActivityAt as the contact's `campaign`.
      const contactId = await crmLeadService.findOrCreateByContact({
        fullName: input.name,
        email: input.email,
        phone: input.phone,
        companyName: input.companyName,
        source: 'API',
        actorId: null,
      })

      // Partial reuse: if this contact already has an open deal in the
      // pipeline (funnel reopened, or continued on another device), reuse
      // that card instead of spawning a second one. Leave its stage
      // untouched — it may already be past Partial from a prior
      // completion, and a re-entry mustn't demote it.
      if (input.mode === 'partial') {
        const existing = await prisma.crmOpportunity.findFirst({
          where: { pipelineId, contactId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
        if (existing) {
          if (input.campaign) {
            await prisma.crmLead.update({
              where: { id: contactId },
              data: { campaign: input.campaign, lastActivityAt: new Date() },
            })
          }
          return {
            contactId,
            opportunityId: existing.id,
            partial: true as const,
          }
        }
      }

      // Route to the named stage ("Partial" / "New Lead"); unmatched or
      // omitted names fall back to the pipeline's first stage.
      const stage = await crmPipelineService.resolveStageId(
        pipelineId,
        input.stage,
      )
      if (!stage) {
        throw new Error('Pipeline has no stages')
      }

      const opportunity = await prisma.crmOpportunity.create({
        data: {
          // Deal name is just the applicant's name — the funnel/source
          // is captured in the `source` column and by the pipeline the
          // deal lands in, so it needn't clutter the name.
          name: input.name.slice(0, 200),
          pipelineId,
          stageId: stage.id,
          contactId,
          contactName: input.name,
          contactEmail: input.email ?? null,
          contactPhone: input.phone ?? null,
          companyName: input.companyName ?? null,
          probability: stage.probability,
          source,
          notes: notes || null,
          companyId,
        },
        select: { id: true },
      })

      // Stamp campaign on the contact when supplied — makes source
      // filters on /admin/contacts work without touching the deal.
      if (input.campaign) {
        await prisma.crmLead.update({
          where: { id: contactId },
          data: { campaign: input.campaign, lastActivityAt: new Date() },
        })
      }

      // Partial captures land silently in the Partial column — omit the
      // `pipelineId` key so the closer notification below doesn't fire
      // until the application is completed (promote/create).
      if (input.mode === 'partial') {
        return { contactId, opportunityId: opportunity.id, partial: true as const }
      }

      return { contactId, opportunityId: opportunity.id, pipelineId }
    })

    // Fire per-funnel lead notifications after the response — never for the
    // append path (that enriched an existing deal, not a new lead).
    if ('pipelineId' in result && result.pipelineId) {
      const pipelineId = result.pipelineId
      const opportunityId = result.opportunityId
      after(() =>
        runAsTenant(companyId, () =>
          notifyLead({
            pipelineId,
            opportunityId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            source,
            answers: input.answers,
          }),
        ),
      )
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[crm/intake]', err)
    const message = err instanceof Error ? err.message : 'Intake failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
