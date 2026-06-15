'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ScrollReveal } from './scroll-reveal'

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}
    >
      {eyebrow && (
        <ScrollReveal delay={0}>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1 text-xs font-medium tracking-wider text-white/70 uppercase backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff4a4a] shadow-[0_0_8px_rgba(255,74,74,0.8)]" />
            {eyebrow}
          </span>
        </ScrollReveal>
      )}
      <ScrollReveal delay={0.08}>
        <h2
          className={cn(
            'max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl',
            '[text-wrap:balance]',
          )}
          style={{ letterSpacing: '-0.035em', lineHeight: 1.05 }}
        >
          {title}
        </h2>
      </ScrollReveal>
      {description && (
        <ScrollReveal delay={0.16}>
          <p
            className={cn(
              'max-w-2xl text-base text-white/60 sm:text-lg',
              '[text-wrap:balance]',
            )}
          >
            {description}
          </p>
        </ScrollReveal>
      )}
    </div>
  )
}
