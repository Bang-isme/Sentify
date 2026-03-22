import { HeroSection } from './HeroSection'
import { ProblemSection } from './ProblemSection'
import { WorkflowSection } from './WorkflowSection'
import { BentoFeatures } from './BentoFeatures'
import { LiveStream } from './LiveStream'
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
      <main id="main-content" className="relative overflow-x-clip overflow-y-visible">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff8ef_0%,#fdf0df_48%,#f8e4ca_100%)] dark:bg-[linear-gradient(135deg,#1b120b_0%,#160f09_52%,#0f0906_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(162,63,0,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(162,63,0,0.028)_1px,transparent_1px)] [background-size:40px_40px] dark:bg-[linear-gradient(rgba(255,228,202,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,228,202,0.035)_1px,transparent_1px)]" />
          <div className="absolute left-[8%] top-[12%] size-[25rem] rounded-full bg-[rgba(235,122,28,0.16)] blur-[150px]" />
          <div className="absolute right-[10%] top-[18%] size-[22rem] rounded-full bg-[rgba(250,181,74,0.18)] blur-[150px]" />
          <div className="absolute left-[-10%] top-[32rem] h-[26rem] w-[18rem] rotate-[16deg] rounded-[999px] border border-[#e5c69d]/55 opacity-60" />
          <div className="absolute right-[-9%] top-[56rem] h-[24rem] w-[16rem] -rotate-[14deg] rounded-[999px] border border-[#ddb889]/50 opacity-55" />
          <div className="absolute left-[18%] top-[96rem] size-[26rem] rounded-full bg-[rgba(235,122,28,0.08)] blur-[180px]" />
          <div className="absolute right-[14%] top-[132rem] size-[24rem] rounded-full bg-[rgba(250,181,74,0.08)] blur-[180px]" />
        </div>

        <div className="relative z-10">
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
          <SecuritySection />
          <CTASection
            primaryLabel={ctaPrimaryLabel}
            secondaryLabel={ctaSecondaryLabel}
            onPrimaryAction={onCtaPrimaryAction}
            onSecondaryAction={onCtaSecondaryAction}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
