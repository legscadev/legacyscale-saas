'use client'

import { SectionHeading } from '../shared/section-heading'
import { FounderBlock } from './founder-block'
import { MetricsGrid } from './metrics-grid'

export function SocialProofSection() {
  return (
    <section id="inside" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Inside the platform"
          title={<>Built around how the program runs.</>}
          description="Every part of the Legacy Scale system has a tool inside the platform. One mentor. One login. No upsells."
        />

        <div className="mt-16">
          <MetricsGrid />
        </div>

        <div id="founder" className="mt-24 scroll-mt-24">
          <FounderBlock />
        </div>
      </div>
    </section>
  )
}
