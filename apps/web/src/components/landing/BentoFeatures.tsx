import { useLanguage } from '../../contexts/languageContext'

const trendBars = [38, 52, 44, 64, 72, 58, 76]

export function BentoFeatures() {
  const { copy } = useLanguage()

  return (
    <section
      id="dashboard"
      className="content-visibility-auto relative bg-bg-light px-6 py-24 dark:bg-bg-dark md:px-12"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-primary-dark dark:text-primary">
              {copy.dashboard.eyebrow}
            </h3>
            <h2 className="mb-4 text-4xl font-bold text-text-charcoal dark:text-white md:text-5xl">
              {copy.dashboard.titleLine1}
              <br />
              <span className="font-serif font-normal italic text-text-silver-light dark:text-text-silver-dark">
                {copy.dashboard.titleLine2}
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-right text-sm font-medium leading-relaxed text-text-silver-light dark:text-text-silver-dark md:text-left dark:font-normal">
            {copy.dashboard.description}
          </p>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-6 md:grid-cols-6 lg:grid-cols-12">
          <OverviewCard />
          {copy.dashboard.smallCards.map((card) => (
            <SmallFeatureCard
              key={card.title}
              icon={card.icon}
              tag={card.tag}
              title={card.title}
              description={card.description}
            />
          ))}
          <SentimentCard />
          <TrendCard />
        </div>
      </div>
    </section>
  )
}

function OverviewCard() {
  const { copy } = useLanguage()

  return (
    <div className="group bento-card relative row-span-2 overflow-hidden rounded-2xl border border-border-light bg-surface-white shadow-sm transition-all duration-500 hover:border-primary/60 dark:border-border-dark dark:bg-surface-dark dark:shadow-none md:col-span-6 lg:col-span-8">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-surface-highlight/50"></div>
      <div className="absolute right-0 top-0 h-full w-2/3">
        <div className="absolute inset-6 rounded-[28px] border border-border-light/60 bg-surface-ticker-light/70 p-5 dark:border-border-dark dark:bg-surface-highlight/55">
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                ...copy.dashboard.overview.kpis,
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border-light/60 bg-white/80 p-3 dark:border-border-dark dark:bg-surface-dark/75"
                >
                  <div className="text-lg font-bold text-text-charcoal dark:text-white">{value}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border-light/60 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-dark/75">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {copy.dashboard.overview.topComplaintsLabel}
              </div>
              <div className="space-y-2">
                {copy.dashboard.overview.complaintRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between text-sm text-text-charcoal dark:text-text-silver-dark"
                  >
                    <span>{label}</span>
                    <span className="font-semibold text-primary-dark dark:text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border-light/60 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-dark/75">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {copy.dashboard.overview.recentMovementLabel}
              </div>
              <div className="flex h-[72px] items-end gap-2">
                {trendBars.map((height, index) => (
                  <div key={index} className="h-full flex-1 rounded-t-full bg-primary/20 dark:bg-primary/30">
                    <div className="w-full rounded-t-full bg-primary" style={{ height: `${height}%` }}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 flex h-full max-w-lg flex-col justify-end p-8">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary-dark transition-colors group-hover:bg-primary group-hover:text-white dark:text-primary dark:group-hover:text-black">
          <span className="material-symbols-outlined text-2xl">dashboard</span>
        </div>
        <h3 className="mb-2 text-2xl font-bold text-text-charcoal dark:text-white">
          {copy.dashboard.overview.title}
        </h3>
        <p className="text-text-silver-light dark:text-text-silver-dark">{copy.dashboard.overview.description}</p>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent group-hover:animate-pulse-border"></div>
    </div>
  )
}

function SmallFeatureCard({
  icon,
  tag,
  title,
  description,
}: {
  icon: string
  tag: string
  title: string
  description: string
}) {
  return (
    <div className="group bento-card relative row-span-1 overflow-hidden rounded-2xl border border-border-light bg-surface-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 dark:border-border-dark dark:bg-surface-dark dark:shadow-none md:col-span-3 lg:col-span-4">
      <div className="mb-8 flex items-start justify-between">
        <span className="material-symbols-outlined text-3xl text-text-silver-light transition-colors group-hover:text-primary dark:text-text-silver-dark">
          {icon}
        </span>
        <span className="rounded bg-surface-ticker-light px-2 py-1 font-mono text-xs text-text-silver-light dark:bg-surface-highlight dark:text-text-silver-dark">
          {tag}
        </span>
      </div>
      <h3 className="mb-2 text-xl font-bold text-text-charcoal dark:text-white">{title}</h3>
      <p className="text-sm text-text-silver-light dark:text-text-silver-dark">{description}</p>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent group-hover:animate-pulse-border"></div>
    </div>
  )
}

function SentimentCard() {
  const { copy } = useLanguage()

  return (
    <div className="group bento-card relative row-span-2 overflow-hidden rounded-2xl border border-border-light bg-surface-white shadow-sm transition-all duration-500 hover:border-primary/60 dark:border-border-dark dark:bg-surface-dark dark:shadow-none md:col-span-6 lg:col-span-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(242,208,13,0.12),transparent_58%)]"></div>
      <div className="relative z-10 flex h-full flex-col justify-end p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="material-symbols-outlined animate-pulse text-2xl text-primary">donut_large</span>
          <span className="text-sm font-bold uppercase text-primary-dark dark:text-primary">
            {copy.dashboard.sentiment.badge}
          </span>
        </div>
        <h3 className="mb-2 text-2xl font-bold text-text-charcoal dark:text-white">
          {copy.dashboard.sentiment.title}
        </h3>
        <p className="text-text-silver-light dark:text-text-silver-dark">{copy.dashboard.sentiment.description}</p>
        <div className="mt-8 space-y-4">
          {copy.dashboard.sentiment.rows.map((row) => (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-text-charcoal dark:text-white">{row.label}</span>
                <span className="text-primary-dark dark:text-primary">{row.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-ticker-light dark:bg-surface-highlight">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${row.value}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent group-hover:animate-pulse-border"></div>
    </div>
  )
}

function TrendCard() {
  const { copy } = useLanguage()
  const bars = [30, 50, 40, 75, 90]
  const barClasses = ['bg-primary/20', 'bg-primary/30', 'bg-primary/40', 'bg-primary/50']

  return (
    <div className="group bento-card relative row-span-2 flex flex-col items-center overflow-hidden rounded-2xl border border-border-light bg-surface-white shadow-sm transition-all duration-500 hover:border-primary/60 dark:border-border-dark dark:bg-surface-dark dark:shadow-none md:col-span-6 md:flex-row lg:col-span-7">
      <div className="relative z-10 flex w-full flex-col justify-center p-8 md:w-1/2">
        <h3 className="mb-3 text-2xl font-bold text-text-charcoal dark:text-white">
          {copy.dashboard.trend.title}
        </h3>
        <p className="mb-6 text-text-silver-light dark:text-text-silver-dark">{copy.dashboard.trend.description}</p>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {copy.dashboard.trend.pill}
        </div>
      </div>
      <div className="relative h-48 w-full bg-surface-ticker-light dark:bg-surface-highlight/40 md:h-full md:w-1/2">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-3/4 w-3/4 items-end justify-between gap-1 border-b border-l border-border-light px-4 pb-4 dark:border-border-dark">
            {bars.map((height, index) => (
              <div
                key={index}
                className={`w-full rounded-t-sm transition-all duration-300 hover:bg-primary ${
                  index === bars.length - 1
                    ? 'bg-primary shadow-[0_4px_10px_rgba(212,175,55,0.3)] dark:shadow-[0_0_15px_rgba(242,208,13,0.5)] dark:hover:bg-white'
                    : barClasses[index] ?? 'bg-primary/30'
                }`}
                style={{ height: `${height}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent group-hover:animate-pulse-border"></div>
    </div>
  )
}
