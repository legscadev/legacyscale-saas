import { MarketingNav } from './nav/marketing-nav'
import { HeroSection } from './hero/hero-section'
import { SocialProofSection } from './social-proof/social-proof-section'
import { ServicesSection } from './services/services-section'
import { FinalCtaSection } from './cta/final-cta-section'
import { MarketingFooter } from './footer/marketing-footer'

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#08070a] text-white antialiased">
      <MarketingNav />
      <main className="relative">
        <HeroSection />
        <SocialProofSection />
        <ServicesSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </div>
  )
}
