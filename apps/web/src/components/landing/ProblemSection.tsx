import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export function ProblemSection() {
  const { copy } = useLanguage()
  const { ref, visible, revealClass, revealStyle } = useScrollReveal()
  const reviewImageSrc = '/images/Review2.png'

  return (
    <section
      id="problem"
      className="problem-section-shell relative w-full overflow-hidden bg-[linear-gradient(180deg,rgba(247,230,206,0.7)_0%,rgba(255,248,239,0.96)_100%)] py-0 dark:bg-[linear-gradient(180deg,rgba(23,16,12,0.98)_0%,rgba(15,10,7,1)_100%)]"
    >
      <div ref={ref} className="w-full">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-12 top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl dark:bg-primary/12" />
          <div className="pointer-events-none absolute right-10 top-8 h-56 w-56 rounded-full bg-primary/10 blur-3xl dark:bg-primary/12" />

          <div
            className={`grid min-h-[940px] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] ${
              visible ? 'animate-problem-section-rise' : 'opacity-0'
            }`}
          >
            <div
              className={`problem-panel-ambient relative isolate flex flex-col justify-between overflow-hidden bg-[#1e1b13] px-8 py-10 text-white md:px-14 md:py-16 lg:px-20 lg:py-20 ${revealClass()}`}
              style={{ ...revealStyle(0), animationDuration: '1.28s' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,134,50,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_48%)]" />
              <div className="pointer-events-none absolute -right-12 bottom-10 h-64 w-64 rounded-full border border-white/8" />
              <div className="pointer-events-none absolute right-16 top-16 h-40 w-40 rounded-full border border-white/8" />
              <div className="pointer-events-none absolute bottom-14 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

              <div className="relative z-10 max-w-[31rem]">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4d3b2]">
                    {copy.problem.eyebrow}
                  </span>
                </div>

                <h2 className="mt-10 text-4xl font-bold leading-[0.95] tracking-tight text-white md:text-5xl xl:text-[4.25rem]">
                  {copy.problem.titleLine1}
                  <span className="mt-3 block font-serif text-[0.92em] font-normal italic text-[#f3a04d]">
                    {copy.problem.titleLine2}
                  </span>
                </h2>

                <p className="mt-8 max-w-[30rem] text-base leading-8 text-white/72 md:text-lg">
                  {copy.problem.description}
                </p>
              </div>

              <div className="relative z-10 mt-12 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {copy.problem.points.map((point, index) => (
                  <div
                    key={point.title}
                    className={`problem-mini-card rounded-[24px] border border-white/8 bg-white/6 px-5 py-4 backdrop-blur-sm ${revealClass()}`}
                    style={revealStyle(160 + index * 90)}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f3a04d]">
                      0{index + 1}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/72">{point.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`relative min-h-[700px] overflow-hidden bg-[#f4ecdf] dark:bg-[#21160f] ${
                visible ? 'animate-problem-image-lift' : 'opacity-0'
              }`}
              style={{ animationDelay: visible ? '220ms' : undefined, animationFillMode: 'both' }}
            >
              <img
                src={reviewImageSrc}
                alt="Restaurant review context"
                className="problem-image-motion absolute inset-0 h-full w-full object-cover object-[center_30%] md:object-[center_34%] lg:object-[center_32%] xl:object-[center_30%]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,239,0.12)_0%,rgba(255,248,239,0.24)_32%,rgba(255,248,239,0.58)_62%,rgba(255,248,239,0.94)_100%)] dark:bg-[linear-gradient(180deg,rgba(33,22,15,0.12)_0%,rgba(33,22,15,0.24)_30%,rgba(33,22,15,0.68)_64%,rgba(33,22,15,0.95)_100%)]" />

              <div
                className={`problem-badge-float absolute right-6 top-6 hidden rounded-full border border-white/40 bg-[#1e1b13]/78 px-5 py-3 text-white shadow-[0_18px_40px_rgba(30,27,19,0.24)] backdrop-blur-xl md:flex ${revealClass()}`}
                style={revealStyle(120)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-white/6">
                    <span className="material-symbols-outlined text-primary">rate_review</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                      Review context
                    </div>
                    <div className="text-sm font-semibold text-white">3 tín hiệu cần xử lý</div>
                  </div>
                </div>
              </div>

              <div
                className={`absolute inset-x-4 bottom-4 md:inset-x-8 md:bottom-8 lg:inset-x-12 lg:bottom-12 ${revealClass()}`}
                style={{ ...revealStyle(320), animationDuration: '1.34s' }}
              >
                <div className="problem-overlay-card overflow-hidden rounded-[32px] border border-white/65 bg-white/88 p-6 shadow-[0_24px_70px_rgba(149,74,0,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[#22170f]/88 dark:shadow-[0_24px_70px_rgba(0,0,0,0.34)] md:p-8">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/75 dark:text-primary/80">
                        Tín hiệu đang bị bỏ lỡ
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-text-charcoal dark:text-white">
                        Ba ma sát vận hành lặp lại
                      </h3>
                    </div>
                    <div className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary dark:border-primary/25 dark:bg-primary/15">
                      03 vấn đề
                    </div>
                  </div>

                  <div className="space-y-4">
                    {copy.problem.points.map((point, index) => (
                      <div
                        key={point.title}
                        className={`problem-row-card flex gap-4 rounded-[24px] border border-border-light/70 bg-white/72 p-4 dark:border-border-dark dark:bg-white/4 ${revealClass()}`}
                        style={revealStyle(280 + index * 100)}
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
                          <span className="material-symbols-outlined text-[24px]">{point.icon}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70 dark:text-primary/80">
                              0{index + 1}
                            </span>
                            <span className="h-px flex-1 bg-primary/12 dark:bg-white/10" />
                          </div>
                          <h4 className="text-lg font-bold leading-snug text-text-charcoal dark:text-white md:text-[1.32rem]">
                            {point.title}
                          </h4>
                          <p className="mt-2 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
                            {point.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
