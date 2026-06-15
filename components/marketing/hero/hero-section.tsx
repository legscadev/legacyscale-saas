'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { GlowButton } from '../shared/glow-button'
import { GradientText } from '../shared/gradient-text'
import { NoiseOverlay } from '../shared/noise-overlay'
import { AuroraBg } from './aurora-bg'

const easeOut = [0.22, 1, 0.36, 1] as const

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      <AuroraBg />
      <NoiseOverlay />

      {/* Center vignette — keeps the type readable over the skyline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(8,7,10,0.55)_0%,rgba(8,7,10,0.2)_55%,transparent_100%)]"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3.5 py-1.5 font-mono text-[10px] font-medium tracking-[0.25em] text-white/80 uppercase backdrop-blur-xl">
            <Sparkles className="h-3 w-3 text-[#ff8a8a]" />
            Course Platform
            <span className="ml-1 h-1 w-1 rounded-full bg-white/30" />
            <span className="text-white/55">For Creators &amp; Coaches</span>
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.1, ease: easeOut }}
          className="mt-8 max-w-5xl text-5xl font-semibold tracking-tight text-white sm:text-7xl lg:text-[88px]"
          style={{ letterSpacing: '-0.045em', lineHeight: 1.02 }}
        >
          Ship your course platform{' '}
          <GradientText variant="brand">in a weekend.</GradientText>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: easeOut }}
          className="mt-7 max-w-2xl text-base text-white/70 sm:text-lg"
          style={{ textWrap: 'balance' }}
        >
          Kondense is the modern members platform for creators, coaches, and
          course sellers. Course library, video hosting, member portal, and
          announcements — all behind your branded login. No glue code, no
          plugins, no upsells.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: easeOut }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <GlowButton href="/login" magnetic={false}>
            Get started
            <ArrowRight className="h-4 w-4" />
          </GlowButton>
          <GlowButton
            href="#features"
            variant="ghost"
            magnetic={false}
            className="hover:scale-100 active:scale-100"
          >
            See features
          </GlowButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.7 }}
          className="mt-14 flex flex-col items-center gap-2 text-[11px] tracking-[0.25em] text-white/35 uppercase"
        >
          <span className="font-mono">Scroll</span>
          <motion.span
            aria-hidden
            animate={{ y: [0, 6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="h-6 w-px bg-gradient-to-b from-white/60 to-transparent"
          />
        </motion.div>
      </div>

      {/* Bottom fade into next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#08070a]" />
    </section>
  )
}
