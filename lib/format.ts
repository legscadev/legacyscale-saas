// Shared display-formatters used across admin + member-facing pages.
// Hoisted here so the per-page duplicates can be removed.

/** "12m ago" / "3d ago" / "2mo ago" / "1y ago". Returns "Never"
 *  for null inputs. Anchored to Date.now() — DO NOT memoize. */
export function relativeTime(date: Date | null): string {
  if (!date) return 'Never'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return `${Math.round(diffMonth / 12)}y ago`
}

/** Two-character initials. First-of-first + first-of-last when the
 *  input has multiple words; otherwise first two chars of the source. */
export function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/** Short locale-formatted date, e.g. "Jun 12, 2026". Returns "—"
 *  for null. */
export function fmtDate(date: Date | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Calendar-date fields (onboarding date, hire date, offboarding
// date, …) are stored as timestamptz at UTC midnight because that's
// what `new Date("2026-07-11")` produces on the input side. Rendering
// them with any TZ-sensitive formatter shifts the label by a day on
// viewers who aren't at UTC — Gillian sees "Jul 10" while Ruel sees
// "Jul 11" for the same row. These two helpers pin the render to
// UTC so every viewer sees whichever calendar day was originally
// picked.

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** "Jul 11, 2026" — TZ-independent. Use for any date field that
 *  represents a calendar day rather than an instant in time. */
export function fmtCalendarDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

/** "Jul 11" — TZ-independent short form for chart labels + card
 *  pills where the year is obvious from context. */
export function fmtCalendarDateShort(
  date: Date | string | null | undefined,
): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** "2026-07-11" — TZ-independent. Use when pre-filling an
 *  <input type=date>, where a local-TZ format shifts the picker to
 *  the previous day for negative-offset viewers. */
export function toCalendarDateInput(
  date: Date | string | null | undefined,
): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns a Tailwind text-color class based on a 0-100 progress value.
 *  Used for visual grading on cohort/member tables so admins can scan
 *  who's on track at a glance. */
export function progressTone(percent: number): string {
  if (percent >= 75) return 'text-success'
  if (percent >= 25) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}
