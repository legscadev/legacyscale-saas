// The /admin/stats ↔ /admin/production-sheets bridge.
//
// Every user with at least one ProductionEntry gets a virtual metric
// card per KPI (12 total — the METRIC_KEYS list). The cards render
// through the same MetricCard the rest of /admin/stats uses, but
// they're read-only mirrors of the production sheet: sums come from
// live ProductionEntry queries, targets come from ProductionTarget,
// and the "Sourced from Production Sheets" badge on the card tells
// admins that the values are entered elsewhere.
//
// The cards live under a synthetic StatDivision (id
// `BRIDGE_DIVISION_ID`) that appears in the divisions rail on
// /admin/stats. Nothing about StatMetric / StatDataPoint changes —
// existing hand-created "Michael Chacon - DMs" rows keep working
// exactly as before, they just co-exist with the bridge cards.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import {
  CURRENCY_METRICS,
  METRIC_KEYS,
  METRIC_LABELS,
  type MetricKey,
} from '@/lib/production/metrics'
import type {
  StatDataPoint,
  StatDivisionSummary,
  StatMetricRow,
} from './stat-tracker-service'

/** Sentinel id + labels for the virtual "Sales — Production Sheets"
 *  division. Placed in a well-known slot so the client can special-
 *  case rendering (lock icon, no + button, no Edit / Delete). */
export const BRIDGE_DIVISION_ID = 'bridge:sales-production'
export const BRIDGE_DIVISION_NAME = 'Sales — Production Sheets'
export const BRIDGE_DIVISION_SHORT_LABEL = 'PROD'
export const BRIDGE_DIVISION_DESCRIPTION =
  'Sourced live from /admin/production-sheets — edit values there.'

/** Sort order for the virtual division. Big number puts it after any
 *  admin-created division. */
const BRIDGE_ORDER_INDEX = 9999

interface BridgeUser {
  userId: string
  name: string
  email: string
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('production-bridge: no active company')
  return id
}

/** Distinct authors of ProductionEntry rows on this tenant, with
 *  display info. `SELECT DISTINCT` at the DB is cheaper than
 *  pulling every entry back to dedupe here. */
async function listAuthors(): Promise<BridgeUser[]> {
  const rows = await prisma.$queryRaw<
    Array<{ user_id: string; name: string | null; email: string }>
  >`
    SELECT DISTINCT u.id AS user_id, u.name, u.email
    FROM production_entries pe
    JOIN users u ON u.id = pe.user_id
    WHERE u.deleted_at IS NULL
    ORDER BY u.name NULLS LAST, u.email
  `
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name?.trim() || (r.email.split('@')[0] ?? r.email),
    email: r.email,
  }))
}

/** Return the virtual division summary so it appears in the divisions
 *  rail on /admin/stats. metricCount reflects the number of bridge
 *  cards we'd render (authors × 12 KPIs). */
export async function getBridgeDivisionSummary(): Promise<StatDivisionSummary> {
  const authors = await listAuthors()
  return {
    id: BRIDGE_DIVISION_ID,
    name: BRIDGE_DIVISION_NAME,
    shortLabel: BRIDGE_DIVISION_SHORT_LABEL,
    description: BRIDGE_DIVISION_DESCRIPTION,
    orderIndex: BRIDGE_ORDER_INDEX,
    metricCount: authors.length * METRIC_KEYS.length,
  }
}

/** Every bridge card. Returned in the same `StatMetricRow` shape so
 *  the existing MetricCard can render them; `bridgeSource` marks
 *  them so MetricCard hides the record/edit/delete affordances. */
export async function listBridgeCards(): Promise<StatMetricRow[]> {
  await requireCompanyId()
  const authors = await listAuthors()
  if (authors.length === 0) return []

  const userIds = authors.map((a) => a.userId)

  // One-shot read of every entry for every author. `notes` isn't
  // needed for the card sums so it's dropped from the select.
  const entries = await prisma.productionEntry.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      date: true,
      phoneCalls: true,
      dms: true,
      dmNumbers: true,
      callConnects: true,
      appointmentsSet: true,
      appointmentsThatShow: true,
      demosConducted: true,
      introUnits: true,
      basicUnits: true,
      majorUnits: true,
      sales: true,
      collections: true,
    },
    orderBy: { date: 'asc' },
  })

  // Monthly targets for the current calendar month only. A card's
  // headline target is scoped to "this month" — same convention the
  // production sheet uses on its target row.
  const now = new Date()
  const targets = await prisma.productionTarget.findMany({
    where: {
      userId: { in: userIds },
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    },
  })
  const targetByUser = new Map(targets.map((t) => [t.userId, t]))

  const out: StatMetricRow[] = []
  for (const author of authors) {
    const authorEntries = entries.filter((e) => e.userId === author.userId)
    const target = targetByUser.get(author.userId)

    for (const [index, key] of METRIC_KEYS.entries()) {
      const card = buildBridgeCard({
        author,
        key,
        orderIndex: index,
        entries: authorEntries,
        targetValue: target ? decimalOrIntToNumber(target[key]) : null,
      })
      // Skip KPIs this user has never entered a value for — a card
      // with an empty sparkline just clutters the board. Materializes
      // the card the first time they type a value into that column
      // on /admin/production-sheets.
      if (card.dataPoints.length === 0) continue
      out.push(card)
    }
  }
  return out
}

function buildBridgeCard(input: {
  author: BridgeUser
  key: MetricKey
  orderIndex: number
  entries: Array<{
    date: Date
    phoneCalls: number | null
    dms: number | null
    dmNumbers: number | null
    callConnects: number | null
    appointmentsSet: number | null
    appointmentsThatShow: number | null
    demosConducted: number | null
    introUnits: number | null
    basicUnits: number | null
    majorUnits: number | null
    sales: Prisma.Decimal | null
    collections: Prisma.Decimal | null
  }>
  targetValue: number | null
}): StatMetricRow {
  const { author, key, orderIndex, entries, targetValue } = input

  // Per-day values feed the MetricCard sparkline. We use the entry's
  // `date` (already normalized to UTC midnight by @db.Date) as the
  // recordedAt so range filters on the card layer match the
  // production sheet's day-of-record semantics exactly.
  const dataPoints: StatDataPoint[] = []
  for (const e of entries) {
    const raw = e[key]
    const value =
      raw === null || raw === undefined
        ? null
        : typeof raw === 'object' // Prisma.Decimal
          ? Number(raw.toString())
          : Number(raw)
    if (value === null) continue
    dataPoints.push({
      id: `bridge:${author.userId}:${key}:${e.date.toISOString()}`,
      value,
      recordedAt: e.date,
      note: null,
      createdBy: null,
    })
  }

  const latest = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1]! : null

  return {
    id: `bridge:${author.userId}:${key}`,
    name: `${author.name} — ${METRIC_LABELS[key]}`,
    description: null,
    unit: CURRENCY_METRICS.has(key) ? 'CURRENCY' : 'COUNT',
    orderIndex,
    targetValue,
    division: {
      id: BRIDGE_DIVISION_ID,
      name: BRIDGE_DIVISION_NAME,
      shortLabel: BRIDGE_DIVISION_SHORT_LABEL,
    },
    assignedTo: {
      // Employee id + userId collapse for bridge cards — there's no
      // separate Employee record, just the User who authored entries.
      id: author.userId,
      userId: author.userId,
      name: author.name,
      roleTitle: 'Sales',
      status: 'ACTIVE',
    },
    latestValue: latest?.value ?? null,
    latestRecordedAt: latest?.recordedAt ?? null,
    dataPoints,
    // Bridge cards are never "legacy manual" — they're live mirrors.
    isLegacyManual: false,
    // Marker so MetricCard renders the read-only branch (no + button,
    // no Edit / Delete, lock hint).
    bridgeSource: 'PRODUCTION_SHEETS',
  }
}

function decimalOrIntToNumber(
  v: number | Prisma.Decimal | null,
): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  return Number(v.toString())
}
