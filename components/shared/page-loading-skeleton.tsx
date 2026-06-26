import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic shell-level loading fallback rendered by the (user) and
 * (admin) segment layout files when a child route is loading and
 * has no more specific loading.tsx of its own. Header + 4-cell
 * StatStrip skeleton — visually consistent with the app's other
 * loading states without committing to a specific page shape.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-1 w-10 rounded-full" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card className="grid grid-cols-2 gap-0 divide-x divide-y divide-border p-0 sm:grid-cols-4 sm:divide-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-3 rounded-sm" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </Card>
    </div>
  )
}
