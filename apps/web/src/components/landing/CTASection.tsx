import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

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
    <section className="content-visibility-auto relative overflow-hidden bg-transparent py-24 md:py-28">
      <div className="absolute inset-0 dark:bg-bg-dark">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(242,208,13,0.15)_0%,rgba(0,0,0,0)_60%)]"></div>
      </div>

      <div ref={ref} className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <h2 className={`mb-6 text-4xl font-bold tracking-tight text-text-charcoal dark:text-white md:text-6xl ${revealClass()}`} style={revealStyle(0)}>
          {copy.cta.titleLine1}
          <br />
          <span className="pr-2 font-serif italic text-primary">{copy.cta.titleLine2}</span>
        </h2>
        <p className={`mx-auto mb-10 max-w-2xl text-base leading-8 text-text-silver-light dark:text-text-silver-dark md:text-lg ${revealClass()}`} style={revealStyle(100)}>
          {copy.cta.description}
        </p>

        <div className={`flex flex-col items-center justify-center gap-4 sm:flex-row ${revealClass()}`} style={revealStyle(200)}>
          <button
            type="button"
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-8 font-bold whitespace-nowrap text-white shadow-[0_10px_20px_rgba(212,175,55,0.3)] transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[#1b120c] dark:shadow-[0_0_20px_rgba(242,208,13,0.3)] dark:hover:bg-yellow-400 sm:w-auto"
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 px-1 text-base font-semibold whitespace-nowrap text-text-charcoal transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-white sm:h-auto sm:w-auto"
            onClick={onSecondaryAction}
          >
            <span>{secondaryLabel}</span>
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1"
            >
              arrow_forward
            </span>
          </button>
        </div>
        <div className={`mt-8 flex flex-wrap items-center justify-center gap-3 text-[14px] font-medium text-text-silver-light dark:text-text-silver-dark ${revealClass()}`} style={revealStyle(300)}>
          {copy.cta.chips.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border-light bg-surface-white/80 px-4 py-2 dark:border-border-dark dark:bg-surface-dark/70"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
