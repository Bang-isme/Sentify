import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export function ProblemSection() {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()

  return (
    <section
      id="problem"
      className="content-visibility-auto relative bg-surface-ticker-light/70 px-6 py-24 dark:bg-surface-ticker-dark/70 md:px-12"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className={`max-w-xl ${revealClass()}`} style={revealStyle(0)}>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">
            {copy.problem.eyebrow}
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-text-charcoal dark:text-white md:text-5xl">
            {copy.problem.titleLine1}
            <br />
            {copy.problem.titleLine2}
          </h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-text-silver-light dark:text-text-silver-dark md:text-lg">
            {copy.problem.description}
          </p>
        </div>

        <div ref={ref} className="grid gap-5 md:grid-cols-3 lg:grid-cols-1">
          {copy.problem.points.map((point, index) => (
            <article
              key={point.title}
              className={`rounded-[28px] border border-border-light bg-surface-white/90 p-6 shadow-sm transition-colors dark:border-border-dark dark:bg-surface-dark/80 ${revealClass()}`}
              style={revealStyle(index * 150)}
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[26px]">{point.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-text-charcoal dark:text-white">{point.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
                {point.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
