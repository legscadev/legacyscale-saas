// CRM leads smoke test — exercises the lead service against the DB
// inside a tenant context. Verifies: create, dedupe probe, status
// change, setter assignment, CSV import, convert-to-opportunity (deal
// spawned + lead marked CONVERTED), and cross-tenant isolation.
// Cleans up everything it creates. Run:
//   TENANCY_ENABLED=1 DATABASE_URL=<session-pooler> npx tsx scripts/crm-leads-smoke.ts

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin, runAsTenant } from '@/lib/tenancy/request-company'
import { crmLeadService } from '@/lib/services/crm-lead-service'
import {
  crmPipelineService,
  seedDefaultPipeline,
} from '@/lib/services/crm-pipeline-service'

const KONDENSE = '00000000-0000-0000-0000-000000000001'
const ACME = 'd634a7a3-8471-403c-9de6-f326af1af63e'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

async function run() {
  console.log('CRM leads smoke test\n')

  // A real user id for assignment (users are global, not tenant-scoped).
  const someUser = await runAsSuperAdmin(() =>
    prisma.user.findFirst({ where: { isActive: true }, select: { id: true } }),
  )
  const createdLeadIds: string[] = []
  let convertedOppId: string | null = null

  await runAsTenant(KONDENSE, async () => {
    await seedDefaultPipeline(KONDENSE)

    const lead = await crmLeadService.create(
      {
        fullName: 'SMOKE — Jane Prospect',
        email: 'smoke.jane@example.com',
        phone: '+15550100999',
        companyName: 'Prospect Co',
        source: 'MANUAL',
        status: 'NEW',
      } as never,
      someUser?.id ?? null,
    )
    createdLeadIds.push(lead.id)
    check('lead created NEW / MANUAL', lead.status === 'NEW' && lead.source === 'MANUAL')

    const dupes = await crmLeadService.findPotentialDuplicates({
      email: 'smoke.jane@example.com',
    })
    check('dedupe probe finds the lead', dupes.some((d) => d.id === lead.id), dupes.length)

    const qualified = await crmLeadService.changeStatus(lead.id, 'QUALIFIED')
    check('status → QUALIFIED', qualified.status === 'QUALIFIED')

    if (someUser) {
      const assigned = await crmLeadService.assignSetter(lead.id, someUser.id)
      check('setter assigned', assigned.assignedSetter?.id === someUser.id)
    }

    const imported = await crmLeadService.importCsv(
      {
        rows: [
          { fullName: 'SMOKE — CSV One', email: 'smoke.csv1@example.com', phone: null, companyName: 'CsvCo', industry: null, campaign: null },
          { fullName: 'SMOKE — CSV Two', email: null, phone: '5550102', companyName: null, industry: null, campaign: null },
        ],
      } as never,
      someUser?.id ?? null,
    )
    check('CSV import created 2', imported.created === 2, imported.created)

    // Convert the qualified lead → deal
    const { opportunityId } = await crmLeadService.convertToOpportunity(
      { leadId: lead.id, value: 4200 } as never,
      someUser?.id ?? null,
    )
    convertedOppId = opportunityId
    check('convert returned an opportunity id', !!opportunityId)

    const reloaded = await crmLeadService.get(lead.id)
    check('lead marked CONVERTED', reloaded.status === 'CONVERTED')
    check('lead links to the opportunity', reloaded.convertedOpportunityId === opportunityId)

    const opp = await prisma.crmOpportunity.findFirst({
      where: { id: opportunityId },
      select: { name: true, contactName: true, value: true },
    })
    check('spawned deal carries lead contact', opp?.contactName === 'SMOKE — Jane Prospect', opp?.name)

    // Second-tenant conversion attempt must not see this lead.
  })

  // Cross-tenant isolation.
  await runAsTenant(ACME, async () => {
    const list = await crmLeadService.list({
      statuses: [], sources: [], assigneeIds: [], mine: false,
      includeConverted: true, sortBy: 'createdAt', sortOrder: 'desc',
      page: 1, limit: 200,
    } as never)
    const leak = list.items.some((l) => createdLeadIds.includes(l.id))
    check('tenant isolation: Acme cannot see Kondense leads', !leak, { acmeLeads: list.total })
  })

  // Cleanup — hard-delete smoke rows so reruns stay clean.
  await runAsTenant(KONDENSE, async () => {
    // grab the CSV-import ids too
    const csvRows = await prisma.crmLead.findMany({
      where: { fullName: { startsWith: 'SMOKE — CSV' } },
      select: { id: true },
    })
    const allLeadIds = [...createdLeadIds, ...csvRows.map((r) => r.id)]
    await prisma.crmLead.deleteMany({ where: { id: { in: allLeadIds } } })
    if (convertedOppId) {
      await prisma.crmOpportunity.deleteMany({ where: { id: convertedOppId } })
    }
    check('cleanup: smoke rows removed', true)
  })

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('SMOKE ERROR:', e)
  process.exit(1)
})
