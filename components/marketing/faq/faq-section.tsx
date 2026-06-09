'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { cn } from '@/lib/utils'
import { ScrollReveal } from '../shared/scroll-reveal'
import { SectionHeading } from '../shared/section-heading'

interface FaqItem {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: 'What does Kondense actually include?',
    a: 'A complete members platform: course builder with chapters and lessons, built-in video hosting, downloadable resources, announcements, member invites, and a polished portal — all on your custom domain.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'Yes. Point a subdomain (or apex) at Kondense, and we auto-issue an SSL certificate. Your members never see a Kondense URL.',
  },
  {
    q: 'Where are videos hosted?',
    a: 'Videos stream through Mux — adaptive bitrate, fast everywhere, encrypted. You upload once; we handle the rest.',
  },
  {
    q: 'Can members watch on mobile?',
    a: 'Yes. The portal is fully responsive and works in any modern mobile browser. A native app is on the roadmap.',
  },
  {
    q: 'Do I own my content and member data?',
    a: 'Always. Your courses, videos, files, and member list are yours. Export at any time.',
  },
  {
    q: 'How fast can I launch?',
    a: 'Most creators have their first course live the same day. Custom domain setup takes minutes; uploading your existing content is the only thing that scales with how much you have.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,74,74,0.04)_0%,transparent_55%)]"
      />

      <div className="relative mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions."
          description="If something isn’t answered here, get in touch."
        />

        <div className="mt-12 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {FAQS.map((item, i) => (
            <FaqRow key={item.q} item={item} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqRow({
  item,
  defaultOpen = false,
}: {
  item: FaqItem
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <ScrollReveal delay={0}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-white">{item.q}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-white/40 transition-transform duration-200',
            open && 'rotate-180 text-white/80',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-sm leading-relaxed text-white/60">
              {item.a}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ScrollReveal>
  )
}
