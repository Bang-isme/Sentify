import { getLocaleWithFallback } from '../../content/localeFallback'
import { useLanguage, type Language } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  LANDING_EYEBROW_CLASS,
  LANDING_PANEL_CLASS,
  LANDING_SECTION_ACCENT_CLASS,
  LANDING_SECTION_HEADER_CLASS,
  LANDING_SECTION_HEADER_MARGIN_CLASS,
  LANDING_SECTION_TITLE_CLASS,
} from './landingVisualSystem'

const securityVisual =
  '/images/trust-voice-signal.svg'

const securityUi: Record<
  Language,
  {
    cardLabels: [string, string, string]
    quote: string
    quoteAuthor: string
  }
> = {
  en: {
    cardLabels: ['Architecture Protocol', 'Authentication Layer', 'Safety Standards'],
    quote: '"Precision is the final ingredient in every curation."',
    quoteAuthor: 'Systems Architect',
  },
  vi: {
    cardLabels: ['Giao thức kiến trúc', 'Lớp xác thực', 'Tiêu chuẩn an toàn'],
    quote: '"Sự chính xác là lớp hoàn thiện cuối cùng để một hệ thống đáng tin cậy được vận hành tốt."',
    quoteAuthor: 'Kiến trúc hệ thống',
  },
  ja: {
    cardLabels: ['設計境界', '認証レイヤー', '安全基準'],
    quote: '「精度は、信頼できる運用を仕上げる最後の要素です。」',
    quoteAuthor: 'システム設計',
  },
}

export function SecuritySection() {
  const { copy, language } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const ui = getLocaleWithFallback(securityUi, language)

  return (
    <section id="trust" className="content-visibility-auto relative overflow-hidden bg-transparent py-28 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-[14%] top-0 h-[24rem] rounded-full bg-[radial-gradient(circle,rgba(162,63,0,0)_0%,transparent_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(235,122,28,0.12)_0%,rgba(242,176,77,0.05)_42%,transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[18rem] bg-[linear-gradient(180deg,transparent_0%,rgba(247,243,238,0)_100%)] dark:bg-[linear-gradient(180deg,transparent_0%,rgba(26,18,14,0.38)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full px-4 md:px-6 lg:px-10 xl:px-14">
        <header className={`${LANDING_SECTION_HEADER_CLASS} ${LANDING_SECTION_HEADER_MARGIN_CLASS}`}>
          <span className={LANDING_EYEBROW_CLASS}>
            {copy.trust.eyebrow}
          </span>
          <h2 className={LANDING_SECTION_TITLE_CLASS}>
            {copy.trust.titleLine1}
            <span className={LANDING_SECTION_ACCENT_CLASS}>{copy.trust.titleLine2}</span>
          </h2>
        </header>

        <div ref={ref}>
          <div className="grid gap-6 md:grid-cols-3">
            {copy.trust.pillars.map((pillar, index) => (
              <article
                key={pillar.title}
                className={`flex h-full flex-col p-8 transition-all duration-300 hover:-translate-y-1 ${LANDING_PANEL_CLASS} ${revealClass()}`}
                style={revealStyle(index * 140)}
              >
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container shadow-[0_12px_24px_rgba(162,63,0,0.12)]">
                  <span
                    className="material-symbols-outlined text-[30px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
                  >
                    {pillar.icon}
                  </span>
                </div>

                <h3 className="font-serif text-[1.8rem] leading-tight text-[#2d221b] dark:text-[#fff7ef]">
                  {pillar.title}
                </h3>
                <p className="mt-4 text-[16px] leading-8 text-[#6f5a4a] dark:text-[#ccb59a]">{pillar.description}</p>

                <div className="mt-auto flex items-center gap-2 pt-8 text-[14px] font-semibold text-primary">
                  <span>{ui.cardLabels[index]}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </div>
              </article>
            ))}
          </div>

          <div
            className={`group relative mt-20 overflow-hidden rounded-[1.6rem] shadow-[0_30px_70px_rgba(56,27,10,0.1)] ${revealClass()}`}
            style={revealStyle(320)}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,29,0.06)_0%,rgba(8,12,29,0.18)_100%)] transition-opacity duration-500 group-hover:opacity-0" />
            <img
              src={securityVisual}
              alt="Audio waveform and digital ear illustration"
              loading="lazy"
              decoding="async"
              className="h-[340px] w-full object-cover transition-all duration-700 group-hover:scale-[1.02] sm:h-[420px] md:h-[520px]"
            />

              <div className="absolute bottom-4 left-4 right-4 max-w-[26rem] sm:bottom-6 sm:left-6 sm:right-auto md:bottom-8 md:left-8">
              <div className={`${LANDING_PANEL_CLASS} p-6`}>
                <p className="font-serif text-[1.55rem] italic leading-relaxed text-[#2b211b] dark:text-[#fff7ef]">
                  {ui.quote}
                </p>
                <span className="mt-3 block text-[12px] uppercase tracking-[0.2em] text-[#7f6858] dark:text-[#ccb59a]">
                  — {ui.quoteAuthor}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
