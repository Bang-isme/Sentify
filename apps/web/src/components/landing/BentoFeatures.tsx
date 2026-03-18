import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const trendBars = [38, 52, 44, 64, 72, 58, 76]

export function BentoFeatures() {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const dashboardDescription = copy.dashboard.description?.trim()

  return (
    <section
      id="dashboard"
      className="content-visibility-auto relative bg-bg-light px-6 py-24 dark:bg-bg-dark md:px-12"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className={`mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end ${revealClass()}`} style={revealStyle(0)}>
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
          {dashboardDescription ? (
            <p className="max-w-sm text-right text-sm font-medium leading-relaxed text-text-silver-light dark:text-text-silver-dark md:text-left dark:font-normal">
              {dashboardDescription}
            </p>
          ) : null}
        </div>

        <div
          ref={ref}
          className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-6 md:grid-cols-6 lg:grid-cols-12 lg:auto-rows-[minmax(220px,auto)]"
        >
          <div className={`md:col-span-6 lg:col-span-7 ${revealClass()}`} style={revealStyle(0)}>
            <OverviewCard />
          </div>
          <div className={`md:col-span-6 lg:col-span-5 lg:row-span-2 ${revealClass()}`} style={revealStyle(120)}>
            <TrendCard />
          </div>
          <div className={`md:col-span-6 lg:col-span-7 ${revealClass()}`} style={revealStyle(240)}>
            <SentimentCard />
          </div>
        </div>
      </div>
    </section>
  )
}

function OverviewCard() {
  const { copy } = useLanguage()

  return (
    <div className="group bento-card relative h-full overflow-hidden rounded-2xl border border-border-light bg-surface-white shadow-sm transition-all duration-500 hover:border-primary/60 dark:border-border-dark dark:bg-surface-dark dark:shadow-none">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-surface-highlight/50"></div>
      <div className="relative z-10 grid gap-6 p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary-dark transition-colors group-hover:bg-primary group-hover:text-white dark:text-primary dark:group-hover:text-black">
            <span className="material-symbols-outlined text-2xl">dashboard</span>
          </div>
          <h3 className="mb-2 text-2xl font-bold text-text-charcoal dark:text-white">
            {copy.dashboard.overview.title}
          </h3>
          <p className="text-text-silver-light dark:text-text-silver-dark">{copy.dashboard.overview.description}</p>
        </div>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[...copy.dashboard.overview.kpis].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-border-light/60 bg-white/80 p-3 text-center dark:border-border-dark dark:bg-surface-dark/75"
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
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm text-text-charcoal dark:text-text-silver-dark"
                >
                  <span className="truncate">{label}</span>
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
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent group-hover:animate-pulse-border"></div>
    </div>
  )
}

function SentimentCard() {
  const { copy } = useLanguage()

  return (
    <div className="relative h-full rounded-2xl border border-border-light/80 bg-surface-white p-8 shadow-sm dark:border-border-dark dark:bg-surface-dark">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary-dark dark:text-primary">
          <span className="material-symbols-outlined text-lg">donut_large</span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-text-silver-light dark:text-text-silver-dark">
          {copy.dashboard.sentiment.badge}
        </span>
      </div>
      <h3 className="mb-2 text-2xl font-semibold text-text-charcoal dark:text-white">
        {copy.dashboard.sentiment.title}
      </h3>
      <p className="text-sm leading-relaxed text-text-silver-light dark:text-text-silver-dark">
        {copy.dashboard.sentiment.description}
      </p>
      <div className="mt-6 space-y-4">
        {copy.dashboard.sentiment.rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-text-charcoal dark:text-white">{row.label}</span>
              <span className="font-semibold text-primary-dark dark:text-primary">{row.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-ticker-light dark:bg-surface-highlight">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${row.value}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendCard() {
  const { copy } = useLanguage()
  const bars = [30, 50, 40, 75, 90]
  const barClasses = ['bg-primary/20', 'bg-primary/25', 'bg-primary/30', 'bg-primary/35']

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border-light/80 bg-surface-white shadow-sm dark:border-border-dark dark:bg-surface-dark">
      <div className="p-8">
        <h3 className="mb-3 text-2xl font-semibold text-text-charcoal dark:text-white">
          {copy.dashboard.trend.title}
        </h3>
        <p className="text-sm leading-relaxed text-text-silver-light dark:text-text-silver-dark">
          {copy.dashboard.trend.description}
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
          {copy.dashboard.trend.pill}
        </div>
      </div>
      <div className="mt-auto px-8 pb-8">
        <div className="h-36 rounded-xl bg-surface-ticker-light/70 p-4 dark:bg-surface-highlight/40">
          <div className="flex h-full items-end justify-between gap-2 border-b border-border-light/70 pb-2 dark:border-border-dark">
            {bars.map((height, index) => (
              <div
                key={index}
                className={`w-full rounded-md ${
                  index === bars.length - 1 ? 'bg-primary' : barClasses[index] ?? 'bg-primary/30'
                }`}
                style={{ height: `${height}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
