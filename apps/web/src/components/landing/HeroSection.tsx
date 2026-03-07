import { AsciiGlobe } from './hero/AsciiGlobe'
import { MarqueeTicker } from './MarqueeTicker'
import { useLanguage } from '../../contexts/languageContext'

interface HeroSectionProps {
  primaryLabel: string
  secondaryLabel: string
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

export function HeroSection({
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: HeroSectionProps) {
  const { copy } = useLanguage()

  return (
    <section
      id="overview"
      className="relative min-h-[100svh] overflow-hidden bg-bg-light dark:bg-bg-dark"
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(242,238,230,0.24)_0%,rgba(242,238,230,0.05)_22%,transparent_52%),radial-gradient(circle_at_78%_28%,rgba(176,146,52,0.05)_0%,transparent_34%),linear-gradient(120deg,#f3efe8_0%,#ebe5db_52%,#e2dbcf_100%)] dark:bg-[radial-gradient(circle_at_22%_18%,rgba(214,175,77,0.03)_0%,rgba(214,175,77,0.01)_24%,transparent_52%),radial-gradient(circle_at_78%_24%,rgba(245,215,120,0.025)_0%,transparent_34%),linear-gradient(120deg,#181510_0%,#13100b_58%,#0e0c09_100%)]"></div>
        <div className="absolute left-[18%] top-[18%] size-[28rem] animate-float-slow rounded-full bg-primary/3 blur-[120px] mix-blend-multiply dark:bg-primary/3 dark:mix-blend-screen"></div>
        <div className="absolute bottom-[18%] right-[16%] size-[22rem] animate-float-medium rounded-full bg-primary/3 blur-[96px] mix-blend-multiply dark:bg-primary/2 dark:mix-blend-screen"></div>
        <div className="absolute left-1/2 top-[46%] h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(255,247,225,0.08)_0%,rgba(255,247,225,0.018)_28%,transparent_66%)] dark:bg-[radial-gradient(circle_at_center,rgba(247,221,138,0.016)_0%,rgba(247,221,138,0.006)_26%,transparent_66%)]"></div>
        <div className="absolute inset-y-0 right-0 w-[56%] bg-[radial-gradient(circle_at_50%_45%,rgba(176,146,52,0.03)_0%,rgba(176,146,52,0.008)_30%,transparent_66%)] dark:bg-[radial-gradient(circle_at_50%_45%,rgba(245,216,125,0.012)_0%,rgba(245,216,125,0.004)_30%,transparent_68%)]"></div>
        <div className="absolute bottom-0 h-1/2 w-full origin-bottom bg-[linear-gradient(to_bottom,transparent_0%,rgba(238,234,227,0.9)_100%),repeating-linear-gradient(90deg,rgba(77,65,34,0.025)_0px,rgba(77,65,34,0.025)_1px,transparent_1px,transparent_100px),repeating-linear-gradient(0deg,rgba(77,65,34,0.025)_0px,rgba(77,65,34,0.025)_1px,transparent_1px,transparent_100px)] [transform:perspective(1000px)_rotateX(60deg)_translateY(200px)] dark:bg-[linear-gradient(to_bottom,transparent_0%,rgba(22,20,16,0.92)_100%),repeating-linear-gradient(90deg,rgba(255,233,176,0.014)_0px,rgba(255,233,176,0.014)_1px,transparent_1px,transparent_100px),repeating-linear-gradient(0deg,rgba(255,233,176,0.014)_0px,rgba(255,233,176,0.014)_1px,transparent_1px,transparent_100px)]"></div>
      </div>
      <div className="hero-split-divider hidden lg:block" aria-hidden></div>

      <div className="relative z-10 mx-auto w-full max-w-[1540px] px-6 pb-[4.6rem] pt-[3.2rem] md:px-10 md:pb-[5.4rem] md:pt-[3.45rem] lg:px-14 lg:pt-[3.7rem]">
        <div className="hero-split-layout hero-split-canvas">
          <div className="hero-copy-pane flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-dark shadow-sm animate-fade-in-up dark:bg-primary/5 dark:text-primary dark:shadow-none">
              <span className="size-2 rounded-full bg-primary animate-pulse"></span>
              {copy.hero.badge}
            </div>

            <h1 className="text-5xl font-black leading-[1.02] tracking-tighter text-text-charcoal dark:text-transparent dark:bg-gradient-to-b dark:from-white dark:to-text-silver-dark dark:bg-clip-text md:text-7xl lg:text-8xl">
              {copy.hero.titleLine1}
              <br />
              <span className="animate-text-glow bg-gradient-to-r from-primary to-primary-dark bg-clip-text pr-4 font-serif text-transparent italic font-normal dark:from-primary dark:to-primary">
                {copy.hero.titleLine2}
              </span>
            </h1>

            <p className="max-w-2xl text-lg font-light leading-relaxed text-text-silver-light dark:text-text-silver-dark md:text-xl">
              {copy.hero.description}
            </p>

            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              {copy.hero.highlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border-light bg-surface-white/85 px-4 py-2 text-xs font-medium tracking-wide text-text-charcoal shadow-sm dark:border-border-dark dark:bg-surface-dark/70 dark:text-text-silver-dark dark:shadow-none"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-4 lg:justify-start">
              <button
                type="button"
                className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-full bg-primary px-8 text-base font-bold text-white transition-all hover:pr-6 hover:shadow-[0_10px_30px_rgba(212,175,55,0.4)] dark:text-bg-dark dark:hover:shadow-[0_0_30px_rgba(242,208,13,0.4)]"
                onClick={onPrimaryAction}
              >
                <span className="relative z-10">{primaryLabel}</span>
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined relative z-10 text-xl transition-transform group-hover:translate-x-1"
                >
                  arrow_forward
                </span>
                <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0"></div>
              </button>
              <button
                type="button"
                className="flex h-14 items-center gap-3 rounded-full border border-border-light bg-surface-white px-8 text-base font-bold text-text-charcoal shadow-sm transition-all hover:bg-surface-ticker-light dark:border-border-dark dark:bg-surface-dark/50 dark:text-white dark:shadow-none dark:hover:bg-surface-highlight"
                onClick={onSecondaryAction}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-primary">
                  dashboard
                </span>
                {secondaryLabel}
              </button>
            </div>
          </div>

          <AsciiGlobe />
        </div>
      </div>

      <div className="hero-bottom-ticker relative z-30">
        <MarqueeTicker compact />
      </div>
    </section>
  )
}
