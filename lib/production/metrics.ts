// Production sheet metric catalog. Kept in a Prisma-free module so
// client components can import from it without pulling the server
// bundle into the browser (the service layer imports `prisma` which
// transitively loads `pg` / `node:async_hooks`).

/** Sentinel picked from the user-picker dropdown to request an
 *  aggregated view across every production user. Reserved value —
 *  never collides with a real UUID. Admin-only. Kept here so both
 *  the "use server" actions file and the client shell can import
 *  it without violating the "only async exports" rule. */
export const ALL_USERS = '__all__'

/** All numeric metric columns on ProductionEntry / ProductionTarget,
 *  in the same order they appear on the daily-entry sheet. */
export const METRIC_KEYS = [
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
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]

export const METRIC_LABELS: Record<MetricKey, string> = {
  phoneCalls: 'Phone Calls',
  dms: 'DMs',
  cellConnects: 'Cell Connects',
  appointmentsSet: 'Appointments Set',
  demosConducted: 'Demos Conducted',
  introUnits: 'Intro Units',
  basisUnits: 'Basis Units',
  majorUnits: 'Major Units',
  sales: 'Sales',
  collections: 'Collections',
}

export const CURRENCY_METRICS: ReadonlySet<MetricKey> = new Set([
  'sales',
  'collections',
])

/** Days-in-month for a 1-indexed month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Number of days remaining in the month, counting today. When the
 *  month is entirely in the past, returns 0. Uses local time. */
export function daysLeftInMonth(year: number, month: number): number {
  const now = new Date()
  const total = daysInMonth(year, month)
  if (
    now.getFullYear() > year ||
    (now.getFullYear() === year && now.getMonth() + 1 > month)
  ) {
    return 0
  }
  if (
    now.getFullYear() < year ||
    (now.getFullYear() === year && now.getMonth() + 1 < month)
  ) {
    return total
  }
  return total - now.getDate() + 1
}
