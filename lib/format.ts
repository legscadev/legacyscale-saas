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

/** Returns a Tailwind text-color class based on a 0-100 progress value.
 *  Used for visual grading on cohort/member tables so admins can scan
 *  who's on track at a glance. */
export function progressTone(percent: number): string {
  if (percent >= 75) return 'text-success'
  if (percent >= 25) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}
