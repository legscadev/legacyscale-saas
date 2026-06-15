'use client'

import {
  BookOpen,
  Bell,
  FileText,
  Globe,
  Layers,
  PlayCircle,
  Tag,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

import { GridPattern } from '../shared/grid-pattern'
import { ScrollReveal } from '../shared/scroll-reveal'
import { SectionHeading } from '../shared/section-heading'

interface Feature {
  icon: LucideIcon
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: 'Course builder',
    body: 'Drag-to-reorder chapters and lessons. Add videos, quizzes, or downloadable resources in a few clicks.',
  },
  {
    icon: PlayCircle,
    title: 'Video hosting built in',
    body: 'Direct uploads stream from Mux — adaptive bitrate, encrypted, ad-free. No Vimeo, no YouTube embeds.',
  },
  {
    icon: FileText,
    title: 'Resource library',
    body: 'Attach PDFs, slides, workbooks, or zips to any lesson. Members download with a signed link.',
  },
  {
    icon: Tag,
    title: 'Free or paid access',
    body: 'Mark courses free to open to every signed-in member. Paid courses stay gated behind enrollment.',
  },
  {
    icon: UserPlus,
    title: 'Member invites',
    body: 'Onboard one at a time or bulk — email invites land with a one-click setup link. No password resets.',
  },
  {
    icon: Bell,
    title: 'Announcements',
    body: 'Broadcast updates to your members from a single screen. Track who has and hasn’t opened.',
  },
  {
    icon: Globe,
    title: 'Custom domain',
    body: 'Run on your URL with auto-issued SSL. Your brand, your logo, no Kondense badge in the corner.',
  },
  {
    icon: BookOpen,
    title: 'Member portal that looks shipped',
    body: 'Clean, fast, mobile-friendly course pages so your members feel like they bought premium — because they did.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <GridPattern />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,74,74,0.06)_0%,transparent_60%)]"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Everything you need"
          title={
            <>
              The full course platform.{' '}
              <span className="text-white/55">Nothing duct-taped.</span>
            </>
          }
          description="Eight things that usually take eight tools. One login, one dashboard, one bill."
        />

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon
  return (
    <ScrollReveal delay={Math.min(index * 0.04, 0.24)}>
      <div className="group relative h-full overflow-hidden rounded-2xl bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.035]">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#ff4a4a]/10 text-[#ff8a8a] ring-1 ring-inset ring-[#ff4a4a]/20">
          <Icon className="size-5" />
        </div>
        <h3 className="mt-5 text-base font-semibold text-white">
          {feature.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          {feature.body}
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(400px circle at 50% 0%, rgba(255,74,74,0.08), transparent 70%)',
          }}
        />
      </div>
    </ScrollReveal>
  )
}
