import { useLanguage } from '../../contexts/languageContext'

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

  return (
    <section className="relative overflow-hidden bg-bg-light py-24 dark:bg-bg-dark">
      <div className="absolute inset-0 dark:bg-bg-dark">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(242,208,13,0.15)_0%,rgba(0,0,0,0)_60%)]"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <h2 className="mb-6 text-4xl font-bold tracking-tight text-text-charcoal dark:text-white md:text-6xl">
          {copy.cta.titleLine1}
          <br />
          <span className="pr-2 font-serif italic text-primary">{copy.cta.titleLine2}</span>
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-text-silver-light dark:text-text-silver-dark">
          {copy.cta.description}
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-8 font-bold whitespace-nowrap text-white shadow-[0_10px_20px_rgba(212,175,55,0.3)] transition-colors hover:bg-primary-dark dark:text-bg-dark dark:shadow-[0_0_20px_rgba(242,208,13,0.3)] dark:hover:bg-yellow-400 sm:w-auto"
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="inline-flex h-14 w-full items-center justify-center rounded-full border border-border-light px-8 font-bold whitespace-nowrap text-text-charcoal transition-colors hover:border-primary/50 hover:text-primary dark:border-border-dark dark:text-white sm:w-auto"
            onClick={onSecondaryAction}
          >
            {secondaryLabel}
          </button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-text-silver-light dark:text-text-silver-dark">
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
