import type { ReactNode } from 'react'

import { MarketingNav } from '@/components/marketing/nav/marketing-nav'
import { MarketingFooter } from '@/components/marketing/footer/marketing-footer'

interface LegalPageShellProps {
  title: string
  effectiveDate: string
  children: ReactNode
}

/** Wrapper for public legal pages (/privacy, /terms). Shares the
 *  dark marketing shell (nav + footer) so branding matches the
 *  landing page, then renders the doc body in a readable prose
 *  column. A prominent "template pending legal review" banner
 *  ships at the top of every page — the content that follows is
 *  scaffolding, not counsel. */
export function LegalPageShell({
  title,
  effectiveDate,
  children,
}: LegalPageShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#08070a] text-white antialiased">
      <MarketingNav />
      <main className="relative">
        <div className="mx-auto max-w-3xl px-6 pt-20 pb-24 sm:pt-28">
          <header className="mb-10">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Legal
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-white/50">
              Effective {effectiveDate}
            </p>
          </header>

          <div className="mb-10 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-medium text-amber-50">Template — pending legal review.</p>
            <p className="mt-1 text-amber-100/80">
              This document ships as scaffolding so the app has real routes to
              link to. Replace the body with copy your counsel has approved
              before treating it as binding.
            </p>
          </div>

          <article className="space-y-8 text-[15px] leading-relaxed text-white/80 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul>li]:mt-1 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-white/30 hover:[&_a]:decoration-white">
            {children}
          </article>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
