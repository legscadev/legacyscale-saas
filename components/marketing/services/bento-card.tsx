'use client'

import {
  motion,
  useMotionTemplate,
  useMotionValue,
} from 'framer-motion'
import { type ReactNode, useRef } from 'react'
import { cn } from '@/lib/utils'

interface BentoCardProps {
  title: string
  description: string
  badge?: string
  num?: string
  icon?: ReactNode
  className?: string
  visual?: ReactNode
  accent?: string
  size?: 'sm' | 'md' | 'lg'
}

export function BentoCard({
  title,
  description,
  badge,
  num,
  icon,
  className,
  visual,
  accent = 'rgba(255,90,90,0.35)',
  size = 'md',
}: BentoCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set(e.clientX - rect.left)
    my.set(e.clientY - rect.top)
  }

  const sheen = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, ${accent}, transparent 50%)`

  const sizeClass = {
    sm: 'p-6',
    md: 'p-7',
    lg: 'p-8 sm:p-10',
  }[size]

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md',
        sizeClass,
        className,
      )}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: sheen }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      {num && (
        <div className="absolute right-5 top-5 z-10 font-mono text-[10px] tracking-[0.25em] text-white/30">
          {num}
        </div>
      )}

      <div className="relative flex h-full flex-col">
        {badge && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.2em] text-white/60 uppercase">
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
            />
            {badge}
          </span>
        )}

        {icon && (
          <div className="mt-5 inline-grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/80 backdrop-blur-md">
            {icon}
          </div>
        )}

        <h3
          className={cn(
            'mt-5 font-semibold tracking-tight text-white',
            size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl',
          )}
          style={{ letterSpacing: '-0.025em' }}
        >
          {title}
        </h3>

        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
          {description}
        </p>

        {visual && <div className="mt-auto pt-6">{visual}</div>}
      </div>
    </motion.div>
  )
}
