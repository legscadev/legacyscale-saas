'use client'

import { ArrowRight } from 'lucide-react'
import { AnimatedGradientBg } from '../shared/animated-gradient-bg'
import { GlowButton } from '../shared/glow-button'
import { GradientText } from '../shared/gradient-text'
import { GridPattern } from '../shared/grid-pattern'
import { NoiseOverlay } from '../shared/noise-overlay'
import { ScrollReveal } from '../shared/scroll-reveal'

export function FinalCtaSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative isolate overflow-hidden rounded-3xl bg-[#0a0810] px-6 py-20 text-center sm:px-12 sm:py-28">
          <AnimatedGradientBg intensity="medium" />
          <GridPattern />
          <NoiseOverlay />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,7,10,0.7)_70%)]"
          />

          <div className="relative">
            <ScrollReveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 font-mono text-[10px] font-medium tracking-[0.25em] text-white/70 uppercase backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff4a4a] shadow-[0_0_8px_rgba(255,74,74,0.8)]" />
                Get started
              </span>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <h2
                className="mx-auto mt-7 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl"
                style={{ letterSpacing: '-0.035em', lineHeight: 1.05 }}
              >
                Launch your course platform.{' '}
                <GradientText variant="brand">Today.</GradientText>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.16}>
              <p
                className="mx-auto mt-6 max-w-xl text-base text-white/65 sm:text-lg"
                style={{ textWrap: 'balance' }}
              >
                One platform for your courses, videos, and members. On your
                domain, on your brand, ready in a weekend.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.24}>
              <div className="mt-10 inline-flex flex-col items-center gap-3 sm:flex-row">
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
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  )
}
