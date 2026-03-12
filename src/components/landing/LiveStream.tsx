import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const badgeColors = {
  red: {
    light: 'bg-red-50 text-red-600 border-red-200',
    dark: 'dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  },
  green: {
    light: 'bg-green-50 text-green-600 border-green-200',
    dark: 'dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  },
  blue: {
    light: 'bg-blue-50 text-blue-600 border-blue-200',
    dark: 'dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  },
}

export function LiveStream() {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()

  return (
    <section
      id="signals"
      className="content-visibility-auto bg-surface-ticker-light py-20 dark:bg-surface-ticker-dark"
    >
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-text-silver-light dark:text-text-silver-dark">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
            {copy.signals.eyebrow}
          </h4>
          <p className="text-sm text-text-silver-light dark:text-text-silver-dark">
            {copy.signals.description}
          </p>
        </div>

        <div ref={ref} className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {copy.signals.cards.map((stream, index) => (
            <div key={stream.title} className={revealClass()} style={revealStyle(index * 120)}>
              <StreamCard {...stream} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StreamCard({
  badge,
  icon,
  title,
  description,
  metric,
}: {
  badge: { text: string; color: 'red' | 'green' | 'blue' } | null
  icon: string
  title: string
  description: string
  metric: string
}) {
  return (
    <div className="group cursor-pointer rounded-xl border border-border-light bg-surface-white p-5 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md dark:border-border-dark dark:bg-surface-dark dark:shadow-none dark:hover:shadow-none">
      <div className="mb-4 rounded-[22px] border border-border-light bg-surface-ticker-light p-4 dark:border-border-dark dark:bg-surface-highlight/45">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[26px]">{icon}</span>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              Signal
            </div>
            <div className="text-lg font-bold text-primary-dark dark:text-primary">{metric}</div>
          </div>
        </div>
        {badge && (
          <div
            className={`inline-flex rounded border px-2 py-0.5 text-xs font-bold ${badgeColors[badge.color].light} ${badgeColors[badge.color].dark}`}
          >
            {badge.text}
          </div>
        )}
      </div>
      <h5 className="mb-1 text-lg font-medium text-text-charcoal transition-colors group-hover:text-primary-dark dark:text-white dark:group-hover:text-primary">
        {title}
      </h5>
      <p className="text-sm text-text-silver-light dark:text-text-silver-dark">{description}</p>
    </div>
  )
}
