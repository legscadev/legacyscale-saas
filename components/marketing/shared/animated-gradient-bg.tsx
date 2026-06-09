'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedGradientBgProps {
  className?: string
  intensity?: 'low' | 'medium' | 'high'
}

export function AnimatedGradientBg({
  className,
  intensity = 'medium',
}: AnimatedGradientBgProps) {
  const opacity = { low: 0.35, medium: 0.55, high: 0.8 }[intensity]

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className,
      )}
    >
      <motion.div
        className="absolute -left-1/4 top-[-20%] h-[60vw] w-[60vw] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center,rgba(255,74,74,0.55) 0%,rgba(209,26,26,0.25) 35%,transparent 70%)',
          filter: 'blur(80px)',
          opacity,
        }}
        animate={{
          x: [0, 80, -40, 0],
          y: [0, 60, 30, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute right-[-10%] top-[10%] h-[50vw] w-[50vw] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center,rgba(255,140,90,0.45) 0%,rgba(255,90,40,0.18) 40%,transparent 70%)',
          filter: 'blur(90px)',
          opacity,
        }}
        animate={{
          x: [0, -60, 30, 0],
          y: [0, 40, -20, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[15%] h-[55vw] w-[55vw] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center,rgba(140,80,255,0.28) 0%,rgba(90,40,200,0.12) 40%,transparent 70%)',
          filter: 'blur(100px)',
          opacity,
        }}
        animate={{
          x: [0, 40, -50, 0],
          y: [0, -30, 50, 0],
          scale: [1, 1.05, 0.95, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}
