'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ScrollReveal } from '../shared/scroll-reveal'
import { GradientText } from '../shared/gradient-text'

const STAGES = [
  { tag: 'THEN', body: 'Fortnite pro' },
  { tag: '⟶', body: 'Med-School Dropout' },
  { tag: 'NOW', body: '7-figures online' },
]

export function FounderBlock() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div>
        <ScrollReveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[10px] font-medium tracking-[0.25em] text-white/60 uppercase backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff4a4a] shadow-[0_0_8px_rgba(255,74,74,0.8)]" />
            01 — Built by
          </span>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <h3
            className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl"
            style={{ letterSpacing: '-0.035em', lineHeight: 1.05 }}
          >
            Fortnite pro. Med-School Dropout.{' '}
            <GradientText variant="brand">7-figure operator.</GradientText>
          </h3>
        </ScrollReveal>

        <ScrollReveal delay={0.16}>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/65 sm:text-lg">
            Marketing fulfillment arbitrage is the one skill Keanu Vasquez
            mastered to go from med-school dropout to one of the fastest-growing
            earners online. The 7-Figure Agency Program is the playbook he
            actually runs — now the platform members operate inside.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.24}>
          <div className="mt-10 flex flex-wrap gap-2">
            {STAGES.map((s, i) => (
              <motion.div
                key={s.body}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md"
              >
                <span className="font-mono text-[10px] tracking-[0.2em] text-[#ff8a8a] uppercase">
                  {s.tag}
                </span>
                <span className="text-sm text-white/85">{s.body}</span>
              </motion.div>
            ))}
          </div>
        </ScrollReveal>
      </div>

      <ScrollReveal delay={0.1}>
        <div className="relative">
          {/* Outer glow halo */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px]"
            style={{
              background:
                'radial-gradient(circle at 50% 50%,rgba(255,80,80,0.35),transparent 65%)',
              filter: 'blur(40px)',
            }}
            animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.04, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative isolate aspect-[4/5] overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0a0810]"
            style={{
              boxShadow:
                '0 0 0 1px rgba(255,90,90,0.18), 0 30px 80px -20px rgba(209,26,26,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <Image
              src="/keanu.png"
              alt="Keanu Vasquez"
              fill
              priority
              sizes="(min-width: 1024px) 560px, 90vw"
              className="object-cover object-center"
            />

            {/* Subtle red tint to blend with brand */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{
                background:
                  'linear-gradient(180deg,rgba(255,90,90,0.06) 0%,transparent 30%,transparent 70%,rgba(255,90,90,0.08) 100%)',
              }}
            />

            {/* Bottom gradient for caption legibility */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
            />

            {/* Top scrim for contrast */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent"
            />

            {/* Status pill — top left */}
            <div className="absolute top-5 left-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/40 px-3 py-1 backdrop-blur-xl">
              <span className="relative grid place-items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff4a4a] shadow-[0_0_8px_rgba(255,74,74,0.9)]" />
                <motion.span
                  className="absolute h-1.5 w-1.5 rounded-full bg-[#ff4a4a]"
                  animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
              <span className="font-mono text-[10px] tracking-[0.25em] text-white/80 uppercase">
                Founder
              </span>
            </div>

            {/* Caption block — bottom */}
            <div className="absolute right-5 bottom-5 left-5 z-10 flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase">
                  Keanu Vasquez
                </div>
                <div
                  className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
                  style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
                >
                  Runs the room
                  <br />
                  you're entering.
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase">
                  Track
                </span>
                <span
                  className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  <GradientText variant="brand">7-FIG</GradientText>
                </span>
              </div>
            </div>

            {/* Corner ticks */}
            {[
              'top-3 left-3 border-t border-l',
              'top-3 right-3 border-t border-r',
              'bottom-3 left-3 border-b border-l',
              'bottom-3 right-3 border-b border-r',
            ].map((pos) => (
              <span
                key={pos}
                aria-hidden
                className={`pointer-events-none absolute h-2.5 w-2.5 border-white/40 ${pos}`}
              />
            ))}
          </motion.div>
        </div>
      </ScrollReveal>
    </div>
  )
}
