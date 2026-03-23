import { useLanguage, type Language } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const problemChrome: Record<
  Language,
  {
    badgeEyebrow: string
    badgeTitle: string
    overlayEyebrow: string
    overlayTitle: string
    issueCount: string
  }
> = {
  en: {
    badgeEyebrow: 'Review context',
    badgeTitle: '3 signals need attention',
    overlayEyebrow: 'Signals being missed',
    overlayTitle: 'Three recurring operating frictions',
    issueCount: '03 issues',
  },
  vi: {
    badgeEyebrow: 'Bối cảnh review',
    badgeTitle: '3 tín hiệu cần xử lý',
    overlayEyebrow: 'Tín hiệu đang bị bỏ lỡ',
    overlayTitle: 'Ba ma sát vận hành lặp lại',
    issueCount: '03 vấn đề',
  },
  ja: {
    badgeEyebrow: 'Review context',
    badgeTitle: '3 signals need attention',
    overlayEyebrow: 'Signals being missed',
    overlayTitle: 'Three recurring operating frictions',
    issueCount: '03 issues',
  },
}

export function ProblemSection() {
  const { copy, language } = useLanguage()
  const { ref, visible, revealClass, revealStyle } = useScrollReveal()
  const reviewImageSrc = '/images/Review2.png'
  const chrome = problemChrome[language]

  return (
    <section
      id="problem"
      className="problem-section-shell relative w-full overflow-hidden py-0"
    >
      <div ref={ref} className="mx-auto w-full px-4 md:px-6 lg:px-10 xl:px-14">
        <div className="relative overflow-hidden rounded-[1.75rem] md:rounded-[2.25rem] lg:rounded-[2.75rem]">
          <div className="pointer-events-none absolute -left-12 top-12 h-52 w-52 rounded-full bg-transparent blur-3xl dark:bg-[rgba(235,122,28,0.12)]" />
          <div className="pointer-events-none absolute right-10 top-8 h-56 w-56 rounded-full bg-transparent blur-3xl dark:bg-[rgba(242,176,77,0.1)]" />

          <div
            className={`grid min-h-[760px] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] ${
              visible ? 'animate-problem-section-rise' : 'opacity-0'
            }`}
          >
            <div
              className={`problem-panel-ambient relative isolate flex flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,rgba(42,31,21,0.94)_0%,rgba(28,22,16,0.9)_100%)] px-7 py-7 text-white md:px-10 md:py-10 lg:px-14 lg:py-14 dark:bg-[#1e1b13] ${revealClass()}`}
              style={{ ...revealStyle(0), animationDuration: '1.28s' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,134,50,0.18),transparent_42%),linear-gradient(135deg,rgba(255,248,239,0.06),transparent_48%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(239,134,50,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_48%)]" />
              <div className="pointer-events-none absolute -right-12 bottom-10 h-64 w-64 rounded-full border border-white/8" />
              <span className="pointer-events-none absolute right-14 top-[5.25rem] hidden rotate-[15deg] leading-none text-[#f3a04d]/16 lg:block">
                <span
                  className="material-symbols-outlined inline-block font-light leading-none"
                  style={{ fontSize: '13rem', transform: 'scale(1.08, 1.62)' }}
                >
                  bolt
                </span>
              </span>
              <span className="pointer-events-none absolute right-[14.5rem] top-[14rem] hidden rotate-[-13deg] leading-none text-[#f3a04d]/12 lg:block">
                <span
                  className="material-symbols-outlined inline-block font-light leading-none"
                  style={{ fontSize: '8.5rem', transform: 'scale(1.04, 1.46)' }}
                >
                  bolt
                </span>
              </span>
              <div className="pointer-events-none absolute bottom-14 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

              <div className="relative z-10 max-w-[31rem]">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#f4d3b2] md:text-[13px]">
                    {copy.problem.eyebrow}
                  </span>
                </div>

                <h2 className="mt-6 text-4xl font-bold leading-[0.95] tracking-tight text-white md:text-5xl xl:text-[4rem]">
                  {copy.problem.titleLine1}
                  <span className="mt-3 block font-serif text-[0.92em] font-normal italic text-[#f3a04d]">
                    {copy.problem.titleLine2}
                  </span>
                </h2>

                <p className="mt-5 max-w-[29rem] text-base leading-7 text-white/72 md:text-[1.05rem]">
                  {copy.problem.description}
                </p>
              </div>

              <div className="relative z-10 mt-8 grid gap-3.5 sm:grid-cols-3 lg:grid-cols-1">
                {copy.problem.points.map((point, index) => (
                  <div
                    key={point.title}
                    className={`problem-mini-card rounded-[20px] border border-white/8 bg-white/6 px-4.5 py-3 backdrop-blur-sm ${revealClass()}`}
                    style={revealStyle(160 + index * 90)}
                  >
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#f3a04d] md:text-[13px]">
                      0{index + 1}
                    </div>
                    <p className="mt-3 text-base leading-7 text-white/78">{point.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`relative min-h-[560px] overflow-hidden bg-[linear-gradient(135deg,#fff8ef_0%,#fdf0df_48%,#f8e4ca_100%)] dark:bg-[linear-gradient(135deg,#1b120b_0%,#160f09_52%,#0f0906_100%)] ${
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
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,239,0.08)_0%,rgba(253,240,223,0.22)_28%,rgba(255,248,239,0.54)_62%,rgba(255,248,239,0.94)_100%)] dark:bg-[linear-gradient(180deg,rgba(27,18,11,0.12)_0%,rgba(22,15,9,0.24)_30%,rgba(15,9,6,0.68)_64%,rgba(15,9,6,0.95)_100%)]" />

              <div
                className={`problem-badge-float absolute right-6 top-6 hidden rounded-full border border-white/40 bg-[#1e1b13]/78 px-5 py-3 text-white shadow-[0_18px_40px_rgba(30,27,19,0.24)] backdrop-blur-xl md:flex ${revealClass()}`}
                style={revealStyle(120)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-white/6">
                    <span className="material-symbols-outlined text-primary">rate_review</span>
                  </div>
                  <div>
                    <div className="text-[12px] uppercase tracking-[0.18em] text-white/60 md:text-[13px]">
                      {chrome.badgeEyebrow}
                    </div>
                    <div className="text-sm font-semibold text-white">{chrome.badgeTitle}</div>
                  </div>
                </div>
              </div>

              <div
                className={`absolute inset-x-4 bottom-4 md:inset-x-5 md:bottom-5 lg:inset-x-8 lg:bottom-8 ${revealClass()}`}
                style={{ ...revealStyle(320), animationDuration: '1.34s' }}
              >
                <div className="problem-overlay-card overflow-hidden rounded-[28px] border border-white/65 bg-white/88 p-4.5 shadow-[0_24px_70px_rgba(149,74,0,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[#22170f]/88 dark:shadow-[0_24px_70px_rgba(0,0,0,0.34)] md:p-5">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary/75 dark:text-primary/80 md:text-[13px]">
                        {chrome.overlayEyebrow}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-text-charcoal dark:text-white">
                        {chrome.overlayTitle}
                      </h3>
                    </div>
                    <div className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[15px] font-semibold text-primary dark:border-primary/25 dark:bg-primary/15">
                      {chrome.issueCount}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {copy.problem.points.map((point, index) => (
                      <div
                        key={point.title}
                        className={`problem-row-card flex gap-3.5 rounded-[20px] border border-border-light/70 bg-white/72 p-3 dark:border-border-dark dark:bg-white/4 ${revealClass()}`}
                        style={revealStyle(280 + index * 100)}
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
                          <span className="material-symbols-outlined text-[24px]">{point.icon}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary/70 dark:text-primary/80 md:text-[13px]">
                              0{index + 1}
                            </span>
                            <span className="h-px flex-1 bg-primary/12 dark:bg-white/10" />
                          </div>
                          <h4 className="text-lg font-bold leading-snug text-text-charcoal dark:text-white md:text-[1.32rem]">
                            {point.title}
                          </h4>
                          <p className="mt-2 text-base leading-7 text-text-silver-light dark:text-text-silver-dark">
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
