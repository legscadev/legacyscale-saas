'use client'

import { motion } from 'framer-motion'
import { ScrollReveal, staggerContainer } from '../shared/scroll-reveal'
import { GradientText } from '../shared/gradient-text'

const METRICS = [
  { num: '01', value: 'Library', label: 'Courses & lessons', sub: 'Trackable curriculum' },
  { num: '02', value: 'Live', label: 'Trainings & replays', sub: 'Scheduled in-app' },
  { num: '03', value: 'Mentor', label: 'Direct founder access', sub: 'Built into the platform' },
  { num: '04', value: 'Room', label: 'Private community', sub: 'Members only' },
]

export function MetricsGrid() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md sm:grid-cols-4"
    >
      {METRICS.map((m, i) => (
        <ScrollReveal
          key={m.label}
          delay={i * 0.06}
          className="group relative bg-[#08070a]/40 p-6 transition-colors hover:bg-white/[0.02]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(circle at 50% 0%,rgba(255,90,90,0.12),transparent 70%)',
            }}
          />
          <div className="relative">
            <div className="font-mono text-[10px] tracking-[0.2em] text-white/35 uppercase">
              {m.num}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              <GradientText variant="silver">{m.value}</GradientText>
            </div>
            <div className="mt-2 text-sm font-medium text-white/80">
              {m.label}
            </div>
            <div className="mt-1 text-xs text-white/40">{m.sub}</div>
          </div>
        </ScrollReveal>
      ))}
    </motion.div>
  )
}
