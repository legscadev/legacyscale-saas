'use client'

import { useCallback, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
] as const

type RangeValue = (typeof RANGE_OPTIONS)[number]['value']

/**
 * Client picker for the Overview's date range. Writes the choice
 * back into the URL (`?range=…`) so the server-side Overview page
 * can fetch the matching window on the next render. Default is 30d,
 * which is omitted from the URL.
 */
export function OverviewRangePicker({
  initialRange,
}: {
  initialRange: RangeValue
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const onChange = useCallback(
    (value: RangeValue | null) => {
      if (!value) return
      const next = new URLSearchParams(searchParams.toString())
      if (value === '30d') next.delete('range')
      else next.set('range', value)
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname)
      })
    },
    [pathname, router, searchParams],
  )

  return (
    <Select value={initialRange} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto gap-2 text-xs">
        <CalendarRange className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
