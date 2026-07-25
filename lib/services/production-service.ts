// Production sheet — read/write helpers for setter/closer daily
// numbers, monthly targets, and the appointment log.
//
// Auth intent: TEAM callers only see their own rows. ADMIN can
// query any user via the user picker in the shell — enforced at
// the action layer, not here. This service accepts a userId and
// trusts callers to have gated it.

import { Prisma, type AppointmentStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  METRIC_KEYS,
  METRIC_LABELS,
  CURRENCY_METRICS,
  daysInMonth,
  daysLeftInMonth,
  type MetricKey,
} from '@/lib/production/metrics'

// Re-export so callers that already imported from the service keep
// working — but new client-side code should import from
// `@/lib/production/metrics` directly to avoid pulling Prisma.
export { METRIC_KEYS, METRIC_LABELS, CURRENCY_METRICS, daysInMonth, daysLeftInMonth }
export type { MetricKey }

// ─── DAILY ENTRIES ────────────────────────────────────────────

export interface DailyEntry {
  id: string | null
  userId: string
  date: string /** ISO yyyy-mm-dd */
  phoneCalls: number | null
  dms: number | null
  cellConnects: number | null
  appointmentsSet: number | null
  demosConducted: number | null
  introUnits: number | null
  basisUnits: number | null
  majorUnits: number | null
  sales: number | null
  collections: number | null
  notes: string | null
}

/** Format a Date as yyyy-mm-dd in UTC (matching how Prisma stores
 *  `@db.Date` values so round-trips don't shift by a day when the
 *  server timezone is offset). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Build every yyyy-mm-dd string in the given (year, month). */
export function monthDates(year: number, month: number): string[] {
  const total = daysInMonth(year, month)
  const out: string[] = []
  const mm = String(month).padStart(2, '0')
  for (let d = 1; d <= total; d++) {
    out.push(`${year}-${mm}-${String(d).padStart(2, '0')}`)
  }
  return out
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

function mapEntry(
  row: Awaited<ReturnType<typeof prisma.productionEntry.findFirst>>,
  fallbackUserId: string,
  fallbackDate: string,
): DailyEntry {
  if (!row) {
    return {
      id: null,
      userId: fallbackUserId,
      date: fallbackDate,
      phoneCalls: null,
      dms: null,
      cellConnects: null,
      appointmentsSet: null,
      demosConducted: null,
      introUnits: null,
      basisUnits: null,
      majorUnits: null,
      sales: null,
      collections: null,
      notes: null,
    }
  }
  return {
    id: row.id,
    userId: row.userId,
    date: toIsoDate(row.date),
    phoneCalls: row.phoneCalls,
    dms: row.dms,
    cellConnects: row.cellConnects,
    appointmentsSet: row.appointmentsSet,
    demosConducted: row.demosConducted,
    introUnits: row.introUnits,
    basisUnits: row.basisUnits,
    majorUnits: row.majorUnits,
    sales: decimalToNumber(row.sales),
    collections: decimalToNumber(row.collections),
    notes: row.notes,
  }
}

/**
 * Fetch every entry for `userId` in the given (year, month), padded
 * out with empty placeholders for days that have no row yet. The UI
 * grid can then render one row per calendar day without an extra
 * "is-this-day-missing?" check.
 */
export async function listEntriesForMonth(
  userId: string,
  year: number,
  month: number,
): Promise<DailyEntry[]> {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const rows = await prisma.productionEntry.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  })
  const byDate = new Map(rows.map((r) => [toIsoDate(r.date), r]))
  return monthDates(year, month).map((iso) =>
    mapEntry(byDate.get(iso) ?? null, userId, iso),
  )
}

export interface UpsertEntryInput {
  userId: string
  date: string /** yyyy-mm-dd */
  phoneCalls?: number | null
  dms?: number | null
  cellConnects?: number | null
  appointmentsSet?: number | null
  demosConducted?: number | null
  introUnits?: number | null
  basisUnits?: number | null
  majorUnits?: number | null
  sales?: number | null
  collections?: number | null
  notes?: string | null
}

/**
 * Upsert one day's row. Empty submissions with no numeric values and
 * no note are treated as a delete so the grid doesn't accumulate
 * "empty" rows every time a user tabs through.
 */
export async function upsertEntry(input: UpsertEntryInput): Promise<DailyEntry> {
  const dateOnly = new Date(`${input.date}T00:00:00.000Z`)
  const numericFields: (keyof UpsertEntryInput)[] = [
    'phoneCalls',
    'dms',
    'cellConnects',
    'appointmentsSet',
    'demosConducted',
    'introUnits',
    'basisUnits',
    'majorUnits',
    'sales',
    'collections',
  ]
  const allBlank =
    numericFields.every((k) => input[k] === null || input[k] === undefined) &&
    !input.notes
  if (allBlank) {
    await prisma.productionEntry.deleteMany({
      where: { userId: input.userId, date: dateOnly },
    })
    return mapEntry(null, input.userId, input.date)
  }

  const data = {
    phoneCalls: input.phoneCalls ?? null,
    dms: input.dms ?? null,
    cellConnects: input.cellConnects ?? null,
    appointmentsSet: input.appointmentsSet ?? null,
    demosConducted: input.demosConducted ?? null,
    introUnits: input.introUnits ?? null,
    basisUnits: input.basisUnits ?? null,
    majorUnits: input.majorUnits ?? null,
    sales:
      input.sales !== undefined && input.sales !== null
        ? new Prisma.Decimal(input.sales)
        : null,
    collections:
      input.collections !== undefined && input.collections !== null
        ? new Prisma.Decimal(input.collections)
        : null,
    notes: input.notes ?? null,
  }

  // Composite unique includes companyId; the tenancy extension adds
  // the filter on the update path via the where clause below.
  const existing = await prisma.productionEntry.findFirst({
    where: { userId: input.userId, date: dateOnly },
  })
  const row = existing
    ? await prisma.productionEntry.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.productionEntry.create({
        data: { userId: input.userId, date: dateOnly, ...data },
      })
  return mapEntry(row, input.userId, input.date)
}

// ─── MONTHLY TARGETS ──────────────────────────────────────────

export interface MonthlyTargets {
  id: string | null
  userId: string
  year: number
  month: number
  phoneCalls: number | null
  dms: number | null
  cellConnects: number | null
  appointmentsSet: number | null
  demosConducted: number | null
  introUnits: number | null
  basisUnits: number | null
  majorUnits: number | null
  sales: number | null
  collections: number | null
}

function mapTarget(
  row: Awaited<ReturnType<typeof prisma.productionTarget.findFirst>>,
  fallbackUserId: string,
  fallbackYear: number,
  fallbackMonth: number,
): MonthlyTargets {
  if (!row) {
    return {
      id: null,
      userId: fallbackUserId,
      year: fallbackYear,
      month: fallbackMonth,
      phoneCalls: null,
      dms: null,
      cellConnects: null,
      appointmentsSet: null,
      demosConducted: null,
      introUnits: null,
      basisUnits: null,
      majorUnits: null,
      sales: null,
      collections: null,
    }
  }
  return {
    id: row.id,
    userId: row.userId,
    year: row.year,
    month: row.month,
    phoneCalls: row.phoneCalls,
    dms: row.dms,
    cellConnects: row.cellConnects,
    appointmentsSet: row.appointmentsSet,
    demosConducted: row.demosConducted,
    introUnits: row.introUnits,
    basisUnits: row.basisUnits,
    majorUnits: row.majorUnits,
    sales: decimalToNumber(row.sales),
    collections: decimalToNumber(row.collections),
  }
}

export async function getMonthlyTargets(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlyTargets> {
  const row = await prisma.productionTarget.findFirst({
    where: { userId, year, month },
  })
  return mapTarget(row, userId, year, month)
}

export interface UpsertTargetsInput {
  userId: string
  year: number
  month: number
  phoneCalls?: number | null
  dms?: number | null
  cellConnects?: number | null
  appointmentsSet?: number | null
  demosConducted?: number | null
  introUnits?: number | null
  basisUnits?: number | null
  majorUnits?: number | null
  sales?: number | null
  collections?: number | null
}

export async function upsertMonthlyTargets(
  input: UpsertTargetsInput,
): Promise<MonthlyTargets> {
  const data = {
    phoneCalls: input.phoneCalls ?? null,
    dms: input.dms ?? null,
    cellConnects: input.cellConnects ?? null,
    appointmentsSet: input.appointmentsSet ?? null,
    demosConducted: input.demosConducted ?? null,
    introUnits: input.introUnits ?? null,
    basisUnits: input.basisUnits ?? null,
    majorUnits: input.majorUnits ?? null,
    sales:
      input.sales !== undefined && input.sales !== null
        ? new Prisma.Decimal(input.sales)
        : null,
    collections:
      input.collections !== undefined && input.collections !== null
        ? new Prisma.Decimal(input.collections)
        : null,
  }
  const existing = await prisma.productionTarget.findFirst({
    where: { userId: input.userId, year: input.year, month: input.month },
  })
  const row = existing
    ? await prisma.productionTarget.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.productionTarget.create({
        data: {
          userId: input.userId,
          year: input.year,
          month: input.month,
          ...data,
        },
      })
  return mapTarget(row, input.userId, input.year, input.month)
}

// ─── APPOINTMENT LOG ──────────────────────────────────────────

export interface AppointmentRow {
  id: string
  setById: string
  setByName: string
  closerId: string | null
  closerName: string | null
  prospectName: string
  prospectPhone: string | null
  setAt: string
  appointmentAt: string | null
  status: AppointmentStatus
  revenueCollected: number | null
  immediateAmount: number | null
  monthlyPayment: number | null
  funnel: boolean | null
  notes: string | null
}

function mapAppointment(row: {
  id: string
  setById: string
  closerId: string | null
  prospectName: string
  prospectPhone: string | null
  setAt: Date
  appointmentAt: Date | null
  status: AppointmentStatus
  revenueCollected: Prisma.Decimal | null
  immediateAmount: Prisma.Decimal | null
  monthlyPayment: Prisma.Decimal | null
  funnel: boolean | null
  notes: string | null
  setBy: { id: string; name: string | null; email: string }
  closer: { id: string; name: string | null; email: string } | null
}): AppointmentRow {
  return {
    id: row.id,
    setById: row.setById,
    setByName: row.setBy.name ?? row.setBy.email.split('@')[0] ?? row.setBy.email,
    closerId: row.closerId,
    closerName: row.closer
      ? row.closer.name ?? row.closer.email.split('@')[0] ?? row.closer.email
      : null,
    prospectName: row.prospectName,
    prospectPhone: row.prospectPhone,
    setAt: toIsoDate(row.setAt),
    appointmentAt: row.appointmentAt ? row.appointmentAt.toISOString() : null,
    status: row.status,
    revenueCollected: decimalToNumber(row.revenueCollected),
    immediateAmount: decimalToNumber(row.immediateAmount),
    monthlyPayment: decimalToNumber(row.monthlyPayment),
    funnel: row.funnel,
    notes: row.notes,
  }
}

export interface ListAppointmentsOptions {
  /** Filter to appointments involving the given user (as setter OR
   *  closer). Omit to return everyone (admin cross-user view). */
  userId?: string
  /** Restrict to the given month via `setAt`. Omit for all-time. */
  year?: number
  month?: number
}

export async function listAppointments(
  options: ListAppointmentsOptions,
): Promise<AppointmentRow[]> {
  const where: Prisma.AppointmentSetWhereInput = {}
  if (options.userId) {
    where.OR = [{ setById: options.userId }, { closerId: options.userId }]
  }
  if (options.year && options.month) {
    const start = new Date(Date.UTC(options.year, options.month - 1, 1))
    const end = new Date(Date.UTC(options.year, options.month, 1))
    where.setAt = { gte: start, lt: end }
  }
  const rows = await prisma.appointmentSet.findMany({
    where,
    orderBy: [{ setAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      setBy: { select: { id: true, name: true, email: true } },
      closer: { select: { id: true, name: true, email: true } },
    },
    take: 500,
  })
  return rows.map(mapAppointment)
}

export interface UpsertAppointmentInput {
  id?: string
  setById: string
  closerId?: string | null
  prospectName: string
  prospectPhone?: string | null
  setAt: string
  appointmentAt?: string | null
  status: AppointmentStatus
  revenueCollected?: number | null
  immediateAmount?: number | null
  monthlyPayment?: number | null
  funnel?: boolean | null
  notes?: string | null
}

export async function upsertAppointment(
  input: UpsertAppointmentInput,
): Promise<AppointmentRow> {
  const dec = (n: number | null | undefined) =>
    n === null || n === undefined ? null : new Prisma.Decimal(n)
  const data = {
    setById: input.setById,
    closerId: input.closerId ?? null,
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone ?? null,
    setAt: new Date(`${input.setAt}T00:00:00.000Z`),
    appointmentAt: input.appointmentAt ? new Date(input.appointmentAt) : null,
    status: input.status,
    revenueCollected: dec(input.revenueCollected),
    immediateAmount: dec(input.immediateAmount),
    monthlyPayment: dec(input.monthlyPayment),
    funnel: input.funnel ?? null,
    notes: input.notes ?? null,
  }
  const row = input.id
    ? await prisma.appointmentSet.update({
        where: { id: input.id },
        data,
        include: {
          setBy: { select: { id: true, name: true, email: true } },
          closer: { select: { id: true, name: true, email: true } },
        },
      })
    : await prisma.appointmentSet.create({
        data,
        include: {
          setBy: { select: { id: true, name: true, email: true } },
          closer: { select: { id: true, name: true, email: true } },
        },
      })
  return mapAppointment(row)
}

export async function deleteAppointment(id: string): Promise<void> {
  await prisma.appointmentSet.delete({ where: { id } })
}

// ─── MONTHLY AGGREGATES ───────────────────────────────────────

export interface MonthlyAggregateRow {
  year: number
  month: number
  phoneCalls: number
  dms: number
  cellConnects: number
  appointmentsSet: number
  demosConducted: number
  introUnits: number
  basisUnits: number
  majorUnits: number
  sales: number
  collections: number
}

/**
 * Roll up daily entries into monthly totals for the given user
 * across the last `months` months (inclusive of the current month).
 * Feeds the "Master Data" tab table + charts.
 */
export async function listMonthlyAggregates(
  userId: string,
  months = 12,
): Promise<MonthlyAggregateRow[]> {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1),
  )
  const rows = await prisma.productionEntry.findMany({
    where: { userId, date: { gte: start } },
    orderBy: { date: 'asc' },
  })

  const buckets = new Map<string, MonthlyAggregateRow>()
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    buckets.set(key, emptyAggregate(d.getUTCFullYear(), d.getUTCMonth() + 1))
  }
  for (const r of rows) {
    const key = `${r.date.getUTCFullYear()}-${r.date.getUTCMonth() + 1}`
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.phoneCalls += r.phoneCalls ?? 0
    bucket.dms += r.dms ?? 0
    bucket.cellConnects += r.cellConnects ?? 0
    bucket.appointmentsSet += r.appointmentsSet ?? 0
    bucket.demosConducted += r.demosConducted ?? 0
    bucket.introUnits += r.introUnits ?? 0
    bucket.basisUnits += r.basisUnits ?? 0
    bucket.majorUnits += r.majorUnits ?? 0
    bucket.sales += Number(r.sales?.toString() ?? '0')
    bucket.collections += Number(r.collections?.toString() ?? '0')
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year,
  )
}

function emptyAggregate(year: number, month: number): MonthlyAggregateRow {
  return {
    year,
    month,
    phoneCalls: 0,
    dms: 0,
    cellConnects: 0,
    appointmentsSet: 0,
    demosConducted: 0,
    introUnits: 0,
    basisUnits: 0,
    majorUnits: 0,
    sales: 0,
    collections: 0,
  }
}

// ─── USER PICKER ──────────────────────────────────────────────

export interface ProductionUserOption {
  id: string
  name: string
  roleTitle: string | null
}

/**
 * Users the admin picker can view. Anyone with a production grant OR
 * an ADMIN role in the current tenant qualifies. Sorted by name.
 */
export async function listProductionUsers(): Promise<ProductionUserOption[]> {
  // memberTenantScope is imported inline to avoid pulling request
  // cookies at module load (breaks non-request contexts).
  const { memberTenantScope } = await import('@/lib/tenancy/request-company')
  const tenant = await memberTenantScope()
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(tenant ?? {}),
      OR: [
        { role: 'ADMIN' },
        {
          role: 'TEAM',
          teamModuleGrantsHeld: {
            some: { moduleKey: 'production', revokedAt: null },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      employee: { select: { roleTitle: true } },
    },
    orderBy: [{ name: 'asc' }],
    take: 500,
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? r.email.split('@')[0] ?? r.email,
    roleTitle: r.employee?.roleTitle ?? null,
  }))
}
