// CRM pipeline smoke test — exercises the real service layer against
// the DB inside a tenant context (no HTTP / auth stack). Verifies:
//   1. default pipeline + stages seed
//   2. create opportunity lands in the first stage
//   3. move to a WON stage flips status + stamps probability=100
//   4. board list returns the deal
//   5. a second tenant sees NONE of the first tenant's deals (isolation)
// Cleans up the deals it creates. Run:
//   DATABASE_URL=<session-pooler-url> npx tsx scripts/crm-smoke.ts

import { runAsTenant } from '@/lib/tenancy/request-company'
import {
  crmPipelineService,
  seedDefaultPipeline,
} from '@/lib/services/crm-pipeline-service'
import { crmOpportunityService } from '@/lib/services/crm-opportunity-service'

const KONDENSE = '00000000-0000-0000-0000-000000000001'
const ACME = 'd634a7a3-8471-403c-9de6-f326af1af63e'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  const mark = cond ? '✓' : '✗'
  if (!cond) failures++
  console.log(`  ${mark} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

async function run() {
  console.log('CRM pipeline smoke test\n')

  // ---- Tenant A: Kondense ----
  const created = await runAsTenant(KONDENSE, async () => {
    await seedDefaultPipeline(KONDENSE)
    const pipelineId = await crmPipelineService.resolvePipelineId()
    check('default pipeline resolved', !!pipelineId, pipelineId)
    if (!pipelineId) throw new Error('no pipeline')

    const stages = await crmPipelineService.listStages(pipelineId)
    check('nine default stages seeded', stages.length === 9, stages.length)
    const wonStage = stages.find((s) => s.isWon)
    check('a WON stage exists', !!wonStage, wonStage?.name)

    const deal = await crmOpportunityService.create(
      pipelineId,
      {
        name: 'SMOKE — Acme annual',
        value: 12000,
        companyName: 'Acme Corp',
        contactName: 'Jane Doe',
        assigneeIds: [],
      } as never,
      null,
    )
    check('deal created in first stage', deal.stageId === stages[0]!.id, {
      stage: stages[0]!.name,
    })
    check('deal value round-trips as number', deal.value === 12000, deal.value)

    // Move to WON
    const moved = await crmOpportunityService.changeStage(
      deal.id,
      wonStage!.id,
    )
    check('move → status WON', moved.status === 'WON', moved.status)
    check('WON forces probability 100', moved.probability === 100, moved.probability)

    const board = await crmOpportunityService.list(pipelineId, {
      assigneeIds: [],
      mine: false,
    } as never)
    check(
      'board list includes the deal',
      board.some((d) => d.id === deal.id),
      board.length,
    )
    return deal.id
  })

  // ---- Tenant B: Acme — must NOT see Kondense's deal (isolation) ----
  await runAsTenant(ACME, async () => {
    await seedDefaultPipeline(ACME)
    const pipelineId = await crmPipelineService.resolvePipelineId()
    if (!pipelineId) {
      check('acme pipeline resolved', false)
      return
    }
    const board = await crmOpportunityService.list(pipelineId, {
      assigneeIds: [],
      mine: false,
    } as never)
    check(
      'tenant isolation: Acme cannot see Kondense deal',
      !board.some((d) => d.id === created),
      { acmeDeals: board.length },
    )
  })

  // ---- Cleanup ----
  await runAsTenant(KONDENSE, async () => {
    await crmOpportunityService.softDelete(created)
    check('cleanup: smoke deal soft-deleted', true)
  })

  console.log(
    `\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('SMOKE ERROR:', e)
  process.exit(1)
})
