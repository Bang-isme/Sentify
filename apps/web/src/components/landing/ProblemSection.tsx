import { getLocaleWithFallback } from '../../content/localeFallback'
import { useLanguage, type Language } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  LANDING_EYEBROW_CLASS,
  LANDING_SECTION_HEADER_CLASS,
  LANDING_SECTION_ACCENT_CLASS,
  LANDING_SECTION_TITLE_CLASS,
} from './landingVisualSystem'

const problemCardImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAHJ4Nl-tbCiZscoBFvY0pCRQlt7hAM-L-vgIp1r1nXA3JYSrX6Xt3oRLPmBbwiKOIzzXGkitrFG1Y1fxMQysHHOv5XN9k2REtUVt_pgz8HDGCM1Xf-aRFO4_oJgJbU0s93GxrpKDQEeOSizbDG6c41OURyRvKuqtWLbxfijSrBasxuaNrXyMdd_T_jtgo_DjnjX9aRd_PKaEpWV8-J2Ggxc6v2xcxIU7XTv6XuLFmhAP1c_0MV8f2h2wXi0T24_kqexy-IdsTTPw',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxEzKw0Ku6vZmJpS-hckQrhxVF2Plc0O5iRfY71_eF88xps48l8Mn5tvHiIN-4vlQ-N-kD3zT4ZvM1qyKJpoSKirkb92J8-a6BN9YqLxpX5RI4pwCw9VEKvwuJE3kotjRCCkMyWm0DULcHZP6v3EbXHn6qxOb3QkGmcvrvR7B0jzfcncrzyqrf6OkAfhYoRhxjeat4ruu8E5JqnyYgNC7UcwII5nOE7H9u0SN1lEFz7xul10MHei8L5JgEYPOqLG7I6RgbzpOYNA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB4_hX-2UHbQCeqlC8z82cHRygdNP5PgX-2io9_BX0NbiGQw2_pElaPhDp9yPTf3kapejqfFpICyb7_u9Ii_QTvISNpf5DA9On7O2eOaGf07npnFXh6E8zGn3-yUDFxhjwl9-gBxVCyAQ0NwpGGK-1fbRLkkS-IVkWA5uOpUWTu2fFQ4DbnoteEEDoHvUAuWwt0jx8bKLtcrjriN7iIUsFVvBLiDlHRrZd07chA4aYxXMyf7EQE8H8Rut27Rt3LWLiAok36SBp9Pg',
] as const

const problemPanelShellClasses = [
  'inset-x-4 bottom-4 xl:inset-x-5 xl:bottom-5 xl:top-[15.4rem]',
  'inset-x-4 bottom-4 xl:inset-x-5 xl:bottom-5 xl:top-[15.4rem]',
  'inset-x-4 bottom-4 xl:inset-x-5 xl:bottom-5 xl:top-[15.4rem]',
] as const

const problemUi: Record<
  Language,
  {
    statusPills: [string, string, string]
  }
> = {
  en: {
    statusPills: ['Critical', 'Needs attention', 'Needs attention'],
  },
  vi: {
    statusPills: ['Cần ưu tiên', 'Cần chú ý', 'Cần chú ý'],
  },
  ja: {
    statusPills: ['最優先', '要注意', '要注意'],
  },
}

export function ProblemSection() {
  const { copy, language } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const ui = getLocaleWithFallback(problemUi, language)

  return (
    <section id="problem" className="content-visibility-auto relative overflow-hidden py-24 lg:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 dark:bg-[linear-gradient(180deg,rgba(24,16,11,0.08)_0%,rgba(16,11,8,0.22)_100%)]" />
        <div className="absolute inset-x-[10%] top-0 h-[18rem] rounded-full blur-[110px] dark:bg-[radial-gradient(circle,rgba(235,122,28,0.12)_0%,rgba(242,176,77,0.04)_36%,transparent_72%)]" />
      </div>

      <div ref={ref} className="relative z-10 mx-auto w-full px-4 md:px-6 lg:px-10 xl:px-14">
        <header className={`relative z-20 mb-16 gap-5 pt-2 md:mb-20 md:gap-6 md:pt-3 ${LANDING_SECTION_HEADER_CLASS} ${revealClass()}`} style={revealStyle(0)}>
          <span className={`${LANDING_EYEBROW_CLASS} translate-y-[2px]`}>
            {copy.problem.eyebrow}
          </span>
          <h2 className={`${LANDING_SECTION_TITLE_CLASS} max-w-[14ch]`}>
            <span className="block">{copy.problem.titleLine1}</span>
            <span className={LANDING_SECTION_ACCENT_CLASS}>{copy.problem.titleLine2}</span>
          </h2>
        </header>

        <div className={`relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 ${revealClass()}`} style={revealStyle(120)}>
          {copy.problem.points.map((point, index) => (
            <article
              key={point.title}
              className="group relative h-[29rem] overflow-hidden rounded-[1.7rem] bg-[#f7f3ee] shadow-[0_22px_54px_rgba(68,34,11,0.09)] transition-transform duration-500 hover:-translate-y-1 dark:bg-[#1a130f] dark:shadow-[0_24px_56px_rgba(0,0,0,0.36)]"
              style={revealStyle(140 + index * 110)}
            >
              <img
                src={problemCardImages[index] ?? problemCardImages[problemCardImages.length - 1]}
                alt={point.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,10,8,0.1)_0%,rgba(13,10,8,0.2)_34%,rgba(13,10,8,0.54)_68%,rgba(13,10,8,0.72)_100%)] dark:bg-[linear-gradient(180deg,rgba(6,6,6,0.14)_0%,rgba(6,6,6,0.24)_34%,rgba(6,6,6,0.62)_70%,rgba(6,6,6,0.8)_100%)]" />

              <div className="absolute left-6 top-6">
                <span className="font-serif text-[3rem] font-bold leading-none text-[#f3a04d]/92">0{index + 1}</span>
              </div>

              <div className="absolute right-6 top-6">
                <span className="inline-flex min-w-[7rem] items-center justify-center rounded-full border border-white/30 bg-white/72 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a23f00] backdrop-blur-xl dark:border-white/12 dark:bg-[#1d1511]/78 dark:text-[#f0b37a]">
                  {ui.statusPills[index]}
                </span>
              </div>

              <div className={`absolute ${problemPanelShellClasses[index] ?? 'inset-x-4 bottom-4'}`}>
                <div className="flex h-full flex-col rounded-[1.22rem] border border-white/28 bg-[rgba(255,250,245,0.88)] p-5 shadow-[0_16px_34px_rgba(29,15,7,0.14)] backdrop-blur-xl dark:border-white/12 dark:bg-[#19120e]/84 dark:shadow-[0_18px_36px_rgba(0,0,0,0.28)] xl:p-5">
                  <h3 className="max-w-[15rem] text-balance font-serif text-[1.56rem] font-bold leading-[1.05] text-[#1f1a17] dark:text-[#fff7ef] xl:text-[1.62rem]">
                    {point.title}
                  </h3>
                  <p className="mt-4 text-[14px] leading-[1.72] text-[#56473d] dark:text-[#e0cab2] xl:text-[14px]">
                    {point.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
