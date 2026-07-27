// Smoke for pipeline CRUD + card edit (multiple pipelines feature).
// Verifies: create pipeline with custom stages (won/lost auto-flag +
// unique slug), create deal in it, update the deal, delete-guard when
// the pipeline still holds deals, delete the deal, then delete the
// pipeline, and the last-pipeline guard. Cleans up. Run:
//   TENANCY_ENABLED=1 DATABASE_URL=<pooler> npx tsx scripts/crm-pipeline-crud-smoke.ts

import { runAsTenant } from '@/lib/tenancy/request-company'
import {
  crmPipelineService,
  LastPipelineError,
  PipelineInUseError,
} from '@/lib/services/crm-pipeline-service'
import { crmOpportunityService } from '@/lib/services/crm-opportunity-service'

const KONDENSE = '00000000-0000-0000-0000-000000000001'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

async function run() {
  console.log('CRM pipeline CRUD smoke\n')

  await runAsTenant(KONDENSE, async () => {
    // Create a pipeline with custom stages (incl. Won/Lost).
    const created = await crmPipelineService.createPipeline({
      name: 'SMOKE Renewals',
      stageNames: ['Up for renewal', 'In talks', 'Won', 'Lost'],
    })
    check('pipeline created', !!created.id, created.name)

    const stages = await crmPipelineService.listStages(created.id)
    check('4 custom stages', stages.length === 4, stages.map((s) => s.name))
    check('Won stage auto-flagged terminal', !!stages.find((s) => s.name === 'Won')?.isWon)
    check('Lost stage auto-flagged terminal', !!stages.find((s) => s.name === 'Lost')?.isLost)

    // Slug uniqueness — create a second with the same name.
    const dup = await crmPipelineService.createPipeline({
      name: 'SMOKE Renewals',
      stageNames: ['A', 'B'],
    })
    check('duplicate name gets a distinct pipeline', dup.id !== created.id)

    // Create a deal in the pipeline, then edit it.
    const deal = await crmOpportunityService.create(
      created.id,
      { name: 'SMOKE deal', value: 1000, assigneeIds: [] } as never,
      null,
    )
    const updated = await crmOpportunityService.update(deal.id, {
      name: 'SMOKE deal (edited)',
      value: 2500,
    } as never)
    check('deal edit persists', updated.name === 'SMOKE deal (edited)' && updated.value === 2500, updated.value)

    // Delete guard — pipeline holds a deal.
    let blocked = false
    try {
      await crmPipelineService.deletePipeline(created.id)
    } catch (e) {
      blocked = e instanceof PipelineInUseError
    }
    check('delete blocked while pipeline holds deals', blocked)

    // Remove the deal, then the pipeline deletes.
    await crmOpportunityService.softDelete(deal.id)
    await crmPipelineService.deletePipeline(created.id)
    const afterDelete = await crmPipelineService.listStages(created.id)
    check('pipeline deleted (no stages remain)', afterDelete.length === 0)

    // Clean up the dup pipeline too.
    await crmPipelineService.deletePipeline(dup.id)

    // Last-pipeline guard — only the seeded default should remain.
    const remaining = await crmPipelineService.listPipelines()
    let lastGuard = false
    if (remaining.length === 1) {
      try {
        await crmPipelineService.deletePipeline(remaining[0]!.id)
      } catch (e) {
        lastGuard = e instanceof LastPipelineError
      }
    }
    check('last-pipeline delete is blocked', lastGuard, { remaining: remaining.length })
  })

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => { console.error('SMOKE ERROR:', e); process.exit(1) })
