import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export function SecuritySection() {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()

  return (
    <section
      id="trust"
      className="content-visibility-auto relative overflow-hidden bg-bg-light px-6 py-24 dark:bg-bg-dark md:px-12"
    >
      <div className="absolute inset-0 opacity-80 dark:opacity-100">
        <div className="absolute left-1/2 top-0 h-full w-[45rem] -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.08),transparent_68%)] dark:bg-[radial-gradient(circle_at_center,rgba(242,208,13,0.12),transparent_68%)]"></div>
      </div>

      <div className="relative mx-auto max-w-[1440px]">
        <div className={`mb-14 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end ${revealClass()}`} style={revealStyle(0)}>
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">
              {copy.trust.eyebrow}
            </p>
            <h2 className="text-4xl font-bold tracking-tight text-text-charcoal dark:text-white md:text-5xl">
              {copy.trust.titleLine1}
              <br />
              <span className="font-serif text-3xl font-normal italic text-text-silver-light dark:text-text-silver-dark md:text-4xl">
                {copy.trust.titleLine2}
              </span>
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-text-silver-light dark:text-text-silver-dark">
            {copy.trust.description}
          </p>
        </div>

        <div ref={ref} className="grid gap-6 lg:grid-cols-3">
          {copy.trust.pillars.map((pillar, index) => (
            <article
              key={pillar.title}
              className={`rounded-[30px] border border-border-light bg-surface-white/90 p-7 shadow-sm dark:border-border-dark dark:bg-surface-dark/80 ${revealClass()}`}
              style={revealStyle(index * 150)}
            >
              <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[28px]">{pillar.icon}</span>
              </div>
              <h3 className="text-2xl font-bold text-text-charcoal dark:text-white">
                {pillar.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
