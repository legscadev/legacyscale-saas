'use client'

import { Palette, Library, Send, type LucideIcon } from 'lucide-react'

import { ScrollReveal } from '../shared/scroll-reveal'
import { SectionHeading } from '../shared/section-heading'

interface Step {
  number: string
  icon: LucideIcon
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    number: '01',
    icon: Palette,
    title: 'Brand it',
    body: 'Point your domain at Kondense, drop in your logo, and pick your accent color. You’re on your URL in under an hour.',
  },
  {
    number: '02',
    icon: Library,
    title: 'Build your library',
    body: 'Create courses, organise chapters, upload videos directly. Attach resources to any lesson. Mark courses free or gated.',
  },
  {
    number: '03',
    icon: Send,
    title: 'Invite your members',
    body: 'Send invites, open free signup, or import existing customers. Members land in their portal with one click — no password setup friction.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,138,138,0.04)_0%,transparent_55%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Three steps from{' '}
              <span className="text-white/55">empty</span> to live.
            </>
          }
          description="Most creators have their first course live the same day they sign up."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon
  return (
    <ScrollReveal delay={Math.min(index * 0.08, 0.24)}>
      <div className="relative h-full overflow-hidden rounded-2xl bg-white/[0.02] p-7">
        <div className="flex items-start justify-between">
          <span
            className="font-mono text-xs tracking-[0.25em] text-white/40"
            style={{ letterSpacing: '0.25em' }}
          >
            {step.number}
          </span>
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04] text-white/80 ring-1 ring-inset ring-white/[0.08]">
            <Icon className="size-5" />
          </div>
        </div>
        <h3 className="mt-8 text-xl font-semibold text-white">{step.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          {step.body}
        </p>
      </div>
    </ScrollReveal>
  )
}
