import { MarketingNav } from './nav/marketing-nav'
import { HeroSection } from './hero/hero-section'
import { FeaturesSection } from './features/features-section'
import { HowItWorksSection } from './how-it-works/how-it-works-section'
import { FaqSection } from './faq/faq-section'
import { FinalCtaSection } from './cta/final-cta-section'
import { MarketingFooter } from './footer/marketing-footer'

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#08070a] text-white antialiased">
      <MarketingNav />
      <main className="relative">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </div>
  )
}
