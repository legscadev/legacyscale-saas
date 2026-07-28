// Smoke for the pipeline stage editor. Verifies add/update/reorder/
// delete stages + guards (stage holding deals, last stage). Uses a
// throwaway pipeline and cleans it up. Run:
//   TENANCY_ENABLED=1 DATABASE_URL=<pooler> npx tsx scripts/crm-stage-editor-smoke.ts

import { runAsTenant } from '@/lib/tenancy/request-company'
import {
  crmPipelineService,
  StageInUseError,
} from '@/lib/services/crm-pipeline-service'
import { crmOpportunityService } from '@/lib/services/crm-opportunity-service'

const KONDENSE = '00000000-0000-0000-0000-000000000001'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

async function run() {
  console.log('CRM stage-editor smoke\n')

  await runAsTenant(KONDENSE, async () => {
    const pipeline = await crmPipelineService.createPipeline({
      name: 'SMOKE Stage Editor',
      stageNames: ['One', 'Two'],
    })

    // Add a stage
    const added = await crmPipelineService.addStage(pipeline.id, {
      name: 'Three',
      probability: 40,
    })
    check('stage added at end', added.name === 'Three')
    let stages = await crmPipelineService.listStagesWithCounts(pipeline.id)
    check('now 3 stages', stages.length === 3, stages.map((s) => s.name))

    // Update the added stage — rename + colour + won flag
    const upd = await crmPipelineService.updateStage(added.id, {
      name: 'Closed Won',
      color: '#22c55e',
      isWon: true,
    })
    check('update persists', upd.name === 'Closed Won' && upd.isWon && upd.color === '#22c55e')

    // Reorder — reverse the order
    const ids = stages.map((s) => s.id).reverse()
    await crmPipelineService.reorderStages(pipeline.id, ids)
    stages = await crmPipelineService.listStagesWithCounts(pipeline.id)
    check('reorder applied', stages[0]!.id === ids[0], stages.map((s) => s.name))

    // Delete guard — drop a deal in a stage, deletion should refuse
    const firstStage = stages[0]!
    const deal = await crmOpportunityService.create(
      pipeline.id,
      { name: 'SMOKE stage deal', stageId: firstStage.id, assigneeIds: [] } as never,
      null,
    )
    let blocked = false
    try {
      await crmPipelineService.deleteStage(firstStage.id)
    } catch (e) {
      blocked = e instanceof StageInUseError
    }
    check('delete blocked while stage holds a deal', blocked)

    // Remove deal, delete succeeds
    await crmOpportunityService.softDelete(deal.id)
    await crmPipelineService.deleteStage(firstStage.id)
    stages = await crmPipelineService.listStagesWithCounts(pipeline.id)
    check('stage deleted (2 remain)', stages.length === 2)

    // Last-stage guard — delete down to one, then refuse
    await crmPipelineService.deleteStage(stages[0]!.id)
    stages = await crmPipelineService.listStagesWithCounts(pipeline.id)
    let lastGuard = false
    try {
      await crmPipelineService.deleteStage(stages[0]!.id)
    } catch (e) {
      lastGuard = e instanceof StageInUseError
    }
    check('last-stage delete is blocked', lastGuard, { remaining: stages.length })

    // Cleanup — remove the throwaway pipeline (hard-deletes remaining stage).
    await crmPipelineService.deletePipeline(pipeline.id)
    check('cleanup: pipeline removed', true)
  })

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => { console.error('SMOKE ERROR:', e); process.exit(1) })
