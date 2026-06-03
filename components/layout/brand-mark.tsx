import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  /** Sublabel under the wordmark, e.g. "Admin Console" or "Member". */
  context?: string
  /** Icon-only variant — used by the collapsed sidebar. */
  compact?: boolean
  className?: string
}

export function BrandMark({ context, compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950 ring-1 ring-inset ring-white/10">
        <Image
          src="/legacy-scale-logo.png"
          alt="Legacy Scale"
          width={24}
          height={24}
          className="size-6 object-contain"
        />
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">
            Legacy Scale
          </span>
          {context && (
            <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              {context}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
