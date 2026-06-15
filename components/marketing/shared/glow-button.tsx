'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MagneticButton } from './magnetic-button'

interface GlowButtonProps {
  children: ReactNode
  href?: string
  variant?: 'primary' | 'ghost' | 'solid'
  className?: string
  onClick?: () => void
  magnetic?: boolean
}

export function GlowButton({
  children,
  href,
  variant = 'primary',
  className,
  onClick,
  magnetic = true,
}: GlowButtonProps) {
  const base =
    'group relative inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-medium tracking-tight transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-white/40'

  const variants = {
    primary: cn(
      'text-white',
      'bg-[linear-gradient(140deg,#ff4a4a_0%,#d11a1a_60%,#7a0d0d_100%)]',
      'shadow-[0_0_0_1px_rgba(255,80,80,0.4),0_10px_40px_-10px_rgba(209,26,26,0.6),inset_0_1px_0_0_rgba(255,255,255,0.15)]',
      'hover:shadow-[0_0_0_1px_rgba(255,120,120,0.6),0_20px_60px_-10px_rgba(209,26,26,0.8),inset_0_1px_0_0_rgba(255,255,255,0.2)]',
      'hover:scale-[1.02] active:scale-[0.98]',
    ),
    ghost: cn(
      'text-white/90',
      'bg-white/[0.04] backdrop-blur-xl',
      'hover:bg-white/[0.08]',
      'hover:scale-[1.02] active:scale-[0.98]',
    ),
    solid: cn(
      'text-white',
      'bg-[#d11a1a]',
      'hover:bg-[#e93d3d]',
    ),
  }

  const buttonClass = cn(base, variants[variant], className)

  const innerContent = (
    <>
      {variant === 'primary' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        >
          <span className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          <span className="absolute -inset-1 -z-10 rounded-xl bg-[radial-gradient(circle_at_50%_0%,rgba(255,90,90,0.45),transparent_70%)] opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
        </span>
      )}
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </>
  )

  if (href) {
    if (magnetic) {
      return (
        <MagneticButton as="a" href={href} className={buttonClass}>
          {innerContent}
        </MagneticButton>
      )
    }
    return (
      <Link href={href} className={buttonClass}>
        {innerContent}
      </Link>
    )
  }

  if (magnetic) {
    return (
      <MagneticButton onClick={onClick} className={buttonClass}>
        {innerContent}
      </MagneticButton>
    )
  }

  return (
    <button onClick={onClick} className={buttonClass}>
      {innerContent}
    </button>
  )
}
