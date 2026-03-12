import { useLanguage } from '../../contexts/languageContext'

export function SprintScopeSection() {
  const { copy } = useLanguage()

  return (
    <section
      id="sprint-1"
      className="content-visibility-auto relative border-y border-border-light/70 bg-surface-ticker-light/70 px-6 py-24 dark:border-border-dark dark:bg-surface-ticker-dark/70 md:px-12"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-14 max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">
            {copy.sprint.eyebrow}
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-text-charcoal dark:text-white md:text-5xl">
            {copy.sprint.titleLine1}
            <br />
            <span className="font-serif text-3xl font-normal italic text-text-silver-light dark:text-text-silver-dark md:text-4xl">
              {copy.sprint.titleLine2}
            </span>
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.8fr)]">
          <ScopeCard title={copy.sprint.inScopeTitle} icon="task_alt" items={copy.sprint.inScopeItems} />
          <ScopeCard title={copy.sprint.outOfScopeTitle} icon="block" items={copy.sprint.outOfScopeItems} />
          <article className="rounded-[30px] border border-border-light bg-surface-white/90 p-7 shadow-sm dark:border-border-dark dark:bg-surface-dark/80">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <span className="material-symbols-outlined text-base">center_focus_strong</span>
              {copy.sprint.whyTitle}
            </div>
            <ul className="space-y-4">
              {copy.sprint.reasons.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark"
                >
                  <span className="mt-2 size-2 rounded-full bg-primary"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  )
}

function ScopeCard({
  title,
  icon,
  items,
}: {
  title: string
  icon: string
  items: readonly string[]
}) {
  return (
    <article className="rounded-[30px] border border-border-light bg-surface-white/90 p-7 shadow-sm dark:border-border-dark dark:bg-surface-dark/80">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        <h3 className="text-2xl font-bold text-text-charcoal dark:text-white">{title}</h3>
      </div>
      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark"
          >
            <span className="mt-2 size-2 rounded-full bg-primary"></span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

