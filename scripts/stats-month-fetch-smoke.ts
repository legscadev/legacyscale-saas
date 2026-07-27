// Regression smoke for the stats table "January doesn't save" bug.
//
// Root cause: the table navigates months client-side, but the page
// only ever fetched the latest take-N (62) data points per metric —
// so a value saved in a month outside that window persisted to the DB
// yet never came back on reload, reading as "didn't save". The fix is
// listDataPointsInMonth(), which the table now calls per visible month.
//
// This proves: a data point saved into January is returned by the
// month fetch, is NOT returned for a different month, and is tenant-
// isolated. Cleans up after itself. Run:
//   TENANCY_ENABLED=1 DATABASE_URL=<transaction-pooler> npx tsx scripts/stats-month-fetch-smoke.ts

import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin, runAsTenant } from '@/lib/tenancy/request-company'
import {
  listDataPointsInMonth,
  upsertDataPoint,
} from '@/lib/services/stat-tracker-service'

const KONDENSE = '00000000-0000-0000-0000-000000000001'
const ACME = 'd634a7a3-8471-403c-9de6-f326af1af63e'
const ISO = '2026-01-15'

let failures = 0
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`)
}

async function run() {
  console.log('Stats month-fetch smoke\n')

  const admin = await runAsSuperAdmin(() =>
    prisma.user.findFirst({ where: { isActive: true }, select: { id: true } }),
  )

  const created = await runAsTenant(KONDENSE, async () => {
    // Minimal division + metric to hang a data point on.
    const division = await prisma.statDivision.create({
      data: { name: 'SMOKE Division', orderIndex: 999, companyId: KONDENSE },
    })
    const metric = await prisma.statMetric.create({
      data: {
        divisionId: division.id,
        name: 'SMOKE Metric',
        unit: 'COUNT',
        orderIndex: 0,
        companyId: KONDENSE,
      },
    })

    const res = await upsertDataPoint(admin?.id ?? 'system', true, {
      metricId: metric.id,
      recordedAt: ISO,
      value: 42,
    })
    check('January data point saved', res.ok)

    const jan = await listDataPointsInMonth(2026, 1)
    const hit = jan.find((p) => p.metricId === metric.id)
    check('month fetch returns the January point', !!hit && hit.value === 42, hit?.value)

    const feb = await listDataPointsInMonth(2026, 2)
    check(
      'month fetch excludes other months',
      !feb.some((p) => p.metricId === metric.id),
      { febHits: feb.length },
    )

    return { divisionId: division.id, metricId: metric.id }
  })

  // Tenant isolation — Acme's January fetch must not see it.
  await runAsTenant(ACME, async () => {
    const jan = await listDataPointsInMonth(2026, 1)
    check(
      'tenant isolation: Acme cannot see Kondense point',
      !jan.some((p) => p.metricId === created.metricId),
      { acmeJan: jan.length },
    )
  })

  // Cleanup.
  await runAsTenant(KONDENSE, async () => {
    await prisma.statDataPoint.deleteMany({ where: { metricId: created.metricId } })
    await prisma.statMetric.deleteMany({ where: { id: created.metricId } })
    await prisma.statDivision.deleteMany({ where: { id: created.divisionId } })
    check('cleanup: smoke rows removed', true)
  })

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error('SMOKE ERROR:', e)
  process.exit(1)
})
