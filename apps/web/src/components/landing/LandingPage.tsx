import { HeroSection } from './HeroSection'
import { ProblemSection } from './ProblemSection'
import { WorkflowSection } from './WorkflowSection'
import { BentoFeatures } from './BentoFeatures'
import { LiveStream } from './LiveStream'
import { SprintScopeSection } from './SprintScopeSection'
import { SecuritySection } from './SecuritySection'
import { CTASection } from './CTASection'
import { Footer } from '../layout/Footer'

interface LandingPageProps {
  heroPrimaryLabel: string
  heroSecondaryLabel: string
  ctaPrimaryLabel: string
  ctaSecondaryLabel: string
  onHeroPrimaryAction: () => void
  onHeroSecondaryAction: () => void
  onCtaPrimaryAction: () => void
  onCtaSecondaryAction: () => void
}

export function LandingPage({
  heroPrimaryLabel,
  heroSecondaryLabel,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  onHeroPrimaryAction,
  onHeroSecondaryAction,
  onCtaPrimaryAction,
  onCtaSecondaryAction,
}: LandingPageProps) {
  return (
    <>
      <main id="main-content">
        <HeroSection
          primaryLabel={heroPrimaryLabel}
          secondaryLabel={heroSecondaryLabel}
          onPrimaryAction={onHeroPrimaryAction}
          onSecondaryAction={onHeroSecondaryAction}
        />
        <ProblemSection />
        <WorkflowSection />
        <BentoFeatures />
        <LiveStream />
        <SprintScopeSection />
        <SecuritySection />
        <CTASection
          primaryLabel={ctaPrimaryLabel}
          secondaryLabel={ctaSecondaryLabel}
          onPrimaryAction={onCtaPrimaryAction}
          onSecondaryAction={onCtaSecondaryAction}
        />
      </main>
      <Footer />
    </>
  )
}
