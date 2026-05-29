'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import {
  forwardRef,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  strength?: number
  as?: 'button' | 'a'
  href?: string
}

export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  function MagneticButton(
    { children, strength = 0.3, className, as = 'button', href, ...rest },
    _ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.5 })
    const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.5 })

    const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      x.set((e.clientX - cx) * strength)
      y.set((e.clientY - cy) * strength)
    }

    const handleLeave = () => {
      x.set(0)
      y.set(0)
    }

    const inner = (
      <motion.span
        style={{ x: springX, y: springY }}
        className="inline-flex"
      >
        {children}
      </motion.span>
    )

    return (
      <div
        ref={containerRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="inline-block"
      >
        {as === 'a' && href ? (
          <a href={href} className={cn('inline-flex', className)}>
            {inner}
          </a>
        ) : (
          <button className={cn('inline-flex', className)} {...rest}>
            {inner}
          </button>
        )}
      </div>
    )
  },
)
