'use client'

import { motion } from 'framer-motion'
import {
  BookOpen,
  GraduationCap,
  Megaphone,
  Radio,
  TrendingUp,
  Users,
} from 'lucide-react'
import { ScrollReveal } from '../shared/scroll-reveal'
import { SectionHeading } from '../shared/section-heading'
import { BentoCard } from './bento-card'

function LibraryVisual() {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0810]">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 25% 30%,rgba(255,80,80,0.35),transparent 55%),radial-gradient(circle at 80% 70%,rgba(140,80,255,0.25),transparent 55%)',
          filter: 'blur(10px)',
        }}
      />
      <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-px p-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            className="rounded-sm bg-white/[0.04]"
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.15, 0.6, 0.15] }}
            transition={{
              duration: 2 + (i % 5),
              delay: (i % 7) * 0.15,
              repeat: Infinity,
            }}
            style={{
              gridColumn: `span ${(i % 4) + 1}`,
              gridRow: `span ${(i % 3) + 1}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function PulseVisual() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid h-9 w-9 place-items-center">
        <span className="absolute inset-0 rounded-full bg-[#ff4a4a]/30" />
        <motion.span
          className="absolute inset-0 rounded-full bg-[#ff4a4a]/50"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <Radio className="relative h-4 w-4 text-white" />
      </span>
      <span className="font-mono text-[10px] tracking-[0.25em] text-white/55 uppercase">
        Live · Scheduled in-app
      </span>
    </div>
  )
}

function ProgressVisual() {
  return (
    <div className="flex items-end gap-1.5 pt-2">
      {[18, 32, 24, 44, 36, 56, 48, 68, 60, 80].map((h, i) => (
        <motion.div
          key={i}
          className="w-2.5 rounded-sm bg-gradient-to-t from-[#ff4a4a]/30 to-[#ff4a4a]/80"
          initial={{ height: 0 }}
          whileInView={{ height: h }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  )
}

const CARDS = [
  {
    num: '01',
    badge: 'Library',
    title: 'Course library',
    description:
      'Every course, chapter, and lesson — organized by curriculum, navigable in seconds. The full Legacy Scale program in one place.',
    icon: <BookOpen className="h-5 w-5" />,
    accent: 'rgba(255,80,80,0.4)',
    visual: <LibraryVisual />,
    size: 'lg' as const,
    span: 'sm:col-span-4 sm:row-span-2',
  },
  {
    num: '02',
    badge: 'Live',
    title: 'Live trainings',
    description:
      'Live training sessions and replays — scheduled inside the platform.',
    icon: <Radio className="h-5 w-5" />,
    accent: 'rgba(255,140,90,0.35)',
    visual: <PulseVisual />,
    span: 'sm:col-span-2',
  },
  {
    num: '03',
    badge: 'Mentorship',
    title: 'Founder access',
    description:
      'Direct mentorship from Keanu — built into the platform, not bolted on.',
    icon: <GraduationCap className="h-5 w-5" />,
    accent: 'rgba(140,80,255,0.35)',
    span: 'sm:col-span-2',
  },
  {
    num: '04',
    badge: 'Progress',
    title: 'Progress tracking',
    description:
      'Lesson-level checkpoints. Always know what you finished and what comes next.',
    icon: <TrendingUp className="h-5 w-5" />,
    accent: 'rgba(255,80,80,0.35)',
    visual: <ProgressVisual />,
    span: 'sm:col-span-3',
  },
  {
    num: '05',
    badge: 'Announcements',
    title: 'Founder updates',
    description:
      'Drops, schedule changes, and program updates from Keanu — delivered in-app.',
    icon: <Megaphone className="h-5 w-5" />,
    accent: 'rgba(255,170,90,0.35)',
    span: 'sm:col-span-3',
  },
  {
    num: '06',
    badge: 'Community',
    title: 'Private members room',
    description:
      'The members-only room. Built around the operators running the same playbook.',
    icon: <Users className="h-5 w-5" />,
    accent: 'rgba(255,255,255,0.18)',
    span: 'sm:col-span-6',
  },
]

export function ServicesSection() {
  return (
    <section id="features" className="relative py-28 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="02 — Features"
          title={
            <>
              Six features.
              <br />
              <span className="text-white/40">One login.</span>
            </>
          }
          description="Every tool a member touches — built around how the Legacy Scale program actually runs."
        />

        <ScrollReveal delay={0.1} className="mt-16">
          <div className="grid auto-rows-[minmax(240px,auto)] grid-cols-1 gap-4 sm:grid-cols-6">
            {CARDS.map((card) => (
              <BentoCard
                key={card.num}
                num={card.num}
                badge={card.badge}
                title={card.title}
                description={card.description}
                icon={card.icon}
                accent={card.accent}
                visual={card.visual}
                size={card.size}
                className={card.span}
              />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
