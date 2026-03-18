import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export function WorkflowSection() {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const photos = [
    {
      src: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=60',
      alt: 'Không gian ăn uống sáng sủa với nhiều ánh sáng tự nhiên',
    },
    {
      src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=60',
      alt: 'Không gian nhà hàng ấm cúng vào buổi tối',
    },
    {
      src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=60',
      alt: 'Món ăn được bày trí tinh tế trên bàn',
    },
    {
      src: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=60',
      alt: 'Đầu bếp chuẩn bị món ăn trong bếp',
    },
  ]

  return (
    <section
      id="workflow"
      className="content-visibility-auto relative overflow-hidden bg-bg-light px-6 py-24 dark:bg-bg-dark md:px-12"
    >
      <div className="absolute inset-0 opacity-70 dark:opacity-100">
        <div className="absolute inset-x-[12%] top-12 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
      </div>

      <div className="relative mx-auto max-w-[1440px]">
        <div className={`mb-10 flex flex-col gap-6 ${revealClass()}`} style={revealStyle(0)}>
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
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {photos.map((photo) => (
            <figure
              key={photo.src}
              className="overflow-hidden rounded-2xl border border-border-light bg-surface-white/80 shadow-sm dark:border-border-dark dark:bg-surface-dark/70"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="h-36 w-full object-cover sm:h-40"
              />
            </figure>
          ))}
        </div>

        <div ref={ref} className="grid gap-5 lg:grid-cols-4">
          {copy.workflow.steps.map((step, index) => (
            <article
              key={step.step}
              className={`relative rounded-[28px] border border-border-light bg-surface-white/90 p-6 shadow-sm transition-colors dark:border-border-dark dark:bg-surface-dark/80 ${revealClass()}`}
              style={revealStyle(index * 120)}
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
