import Image from 'next/image'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANDING } from '@/lib/branding/defaults'

interface BrandMarkProps {
  /** Sublabel under the wordmark, e.g. "Admin Console" or "Member". */
  context?: string
  /** Icon-only variant — used by the collapsed sidebar. */
  compact?: boolean
  className?: string
  /** Displayed product name. Server layouts pass the tenant's brand
   *  via `getBranding()` when tenancy is on; anything unset falls
   *  back to the platform default (Kondense). */
  productName?: string
  /** Logo image URL. Same fallback rules as `productName`. */
  logoUrl?: string
}

export function BrandMark({
  context,
  compact = false,
  className,
  productName = DEFAULT_BRANDING.productName,
  logoUrl = DEFAULT_BRANDING.logoUrl,
}: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Image
          src={logoUrl}
          alt={productName}
          width={24}
          height={24}
          className="size-6 object-contain"
        />
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">
            {productName}
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
