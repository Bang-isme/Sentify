import { useLanguage } from '../../contexts/languageContext'

export function WorkflowSection() {
  const { copy } = useLanguage()

  return (
    <section
      id="workflow"
      className="content-visibility-auto relative overflow-hidden bg-bg-light px-6 py-24 dark:bg-bg-dark md:px-12"
    >
      <div className="absolute inset-0 opacity-70 dark:opacity-100">
        <div className="absolute inset-x-[12%] top-12 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
      </div>

      <div className="relative mx-auto max-w-[1440px]">
        <div className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">
              {copy.workflow.eyebrow}
            </p>
            <h2 className="text-4xl font-bold tracking-tight text-text-charcoal dark:text-white md:text-5xl">
              {copy.workflow.titleLine1}
              <br />
              <span className="font-serif text-3xl font-normal italic text-text-silver-light dark:text-text-silver-dark md:text-4xl">
                {copy.workflow.titleLine2}
              </span>
            </h2>
          </div>
          <p className="max-w-lg text-base leading-8 text-text-silver-light dark:text-text-silver-dark">
            {copy.workflow.description}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {copy.workflow.steps.map((step) => (
            <article
              key={step.step}
              className="relative rounded-[28px] border border-border-light bg-surface-white/90 p-6 shadow-sm transition-colors dark:border-border-dark dark:bg-surface-dark/80"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-[0.3em] text-primary">
                  {step.step}
                </span>
                <span className="h-px w-14 bg-primary/30"></span>
              </div>
              <h3 className="text-2xl font-bold text-text-charcoal dark:text-white">{step.title}</h3>
              <p className="mt-4 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
