import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  LANDING_BODY_CLASS,
  LANDING_CHIP_CLASS,
  LANDING_SECTION_ACCENT_CLASS,
  LANDING_SECTION_TITLE_CLASS,
} from './landingVisualSystem'

interface CTASectionProps {
  primaryLabel: string
  secondaryLabel: string
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

export function CTASection({
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: CTASectionProps) {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()

  return (
    <section className="content-visibility-auto relative overflow-hidden bg-transparent py-20 md:py-24">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-0 dark:bg-[linear-gradient(180deg,rgba(18,12,8,0.82)_0%,rgba(15,10,7,0.9)_100%)]" />
        <div className="absolute inset-0 dark:bg-[linear-gradient(rgba(255,228,202,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,228,202,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0)_0%,rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(242,176,77,0.16)_0%,rgba(235,122,28,0.06)_34%,rgba(0,0,0,0)_60%)]"></div>
      </div>

      <div ref={ref} className="relative z-10 mx-auto max-w-[56rem] px-6 text-center">
        <h2 className={`${LANDING_SECTION_TITLE_CLASS} mb-5 ${revealClass()}`} style={revealStyle(0)}>
          {copy.cta.titleLine1}
          <br />
          <span className={`${LANDING_SECTION_ACCENT_CLASS} pr-2 text-primary dark:text-[#f3c47f]`}>
            {copy.cta.titleLine2}
          </span>
        </h2>
        <p className={`mx-auto mb-8 max-w-[34rem] ${LANDING_BODY_CLASS} ${revealClass()}`} style={revealStyle(100)}>
          {copy.cta.description}
        </p>

        <div className={`flex flex-col items-center justify-center gap-4 sm:flex-row ${revealClass()}`} style={revealStyle(200)}>
          <button
            type="button"
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-8 text-[1rem] font-bold whitespace-nowrap text-white shadow-[0_1rem_1.9rem_rgba(212,175,55,0.36)] transition-all hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-[0_1.2rem_2.1rem_rgba(212,175,55,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[#1b120c] dark:shadow-[0_0_1.5rem_rgba(242,208,13,0.34)] dark:hover:bg-yellow-400 sm:w-auto"
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="group inline-flex h-11 w-full items-center justify-center gap-2 px-1 text-[0.9375rem] font-semibold whitespace-nowrap text-text-charcoal transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-white sm:h-auto sm:w-auto"
            onClick={onSecondaryAction}
          >
            <span>{secondaryLabel}</span>
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[0.9375rem] transition-transform group-hover:translate-x-1"
            >
              arrow_forward
            </span>
          </button>
        </div>
        <div className={`mt-7 flex flex-wrap items-center justify-center gap-2.5 text-[0.8125rem] font-medium text-text-silver-light dark:text-text-silver-dark md:text-[0.875rem] ${revealClass()}`} style={revealStyle(300)}>
          {copy.cta.chips.map((item) => (
            <span
              key={item}
              className={LANDING_CHIP_CLASS}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
