export type MetricUnit = 'COUNT' | 'CURRENCY' | 'PERCENT'

interface FormatOptions {
  /** Compact style ($1.2K, 1.5M). Defaults false. */
  compact?: boolean
}

/**
 * Human-friendly formatter for stat values. Handles currency,
 * percentage, and plain counts with sensible defaults for each.
 */
export function formatMetricValue(
  value: number,
  unit: MetricUnit,
  opts: FormatOptions = {},
): string {
  if (!Number.isFinite(value)) return '—'

  if (unit === 'CURRENCY') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? 1 : 2,
    }).format(value)
  }

  if (unit === 'PERCENT') {
    // Values arrive as either 0-1 or 0-100 depending on how the
    // admin entered them; the tracker treats the raw number as the
    // percentage so 82 renders as "82%".
    return `${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
    }).format(value)}%`
  }

  return new Intl.NumberFormat('en-US', {
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(value)
}

export function unitLabel(unit: MetricUnit): string {
  if (unit === 'CURRENCY') return 'Currency ($)'
  if (unit === 'PERCENT') return 'Percentage (%)'
  return 'Count'
}
