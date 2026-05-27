import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/legacy-scale-logo.png"
        alt="Legacy Scale"
        width={32}
        height={32}
        priority
        className="rounded-md"
      />
      {showText && (
        <span className="text-lg font-semibold tracking-tight">
          Legacy Scale
        </span>
      )}
    </div>
  )
}
