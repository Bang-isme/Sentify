import { useMemo, useState } from 'react'
import { useLanguage, type Language } from '../../contexts/languageContext'

interface HeroSectionProps {
  primaryLabel: string
  secondaryLabel: string
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

interface HeroVisualCopy {
  eyebrow: string
  searchPlaceholder: string
  searchActionLabel: string
  dashboardLabel: string
  totalReviewsLabel: string
  averageRatingLabel: string
  liveSnapshotLabel: string
  reviewCardTitle: string
  reviewCardTime: string
  reviewCardQuote: string
  sentimentTitle: string
  sentimentPositive: string
  galleryAltPrefix: string
  quoteSource: string
}

const HERO_VISUAL_COPY: Record<Language, HeroVisualCopy> = {
  en: {
    eyebrow: 'Google Maps review intelligence',
    searchPlaceholder: 'Paste your Google Maps URL...',
    searchActionLabel: 'Inspect restaurant review flow',
    dashboardLabel: 'Restaurant dashboard',
    totalReviewsLabel: 'Total reviews',
    averageRatingLabel: 'Avg rating',
    liveSnapshotLabel: 'Live review snapshot',
    reviewCardTitle: 'Guest signal',
    reviewCardTime: '2 minutes ago',
    reviewCardQuote: '"Guests keep mentioning faster service after the menu update."',
    sentimentTitle: 'Sentiment trend',
    sentimentPositive: 'Positive shift',
    galleryAltPrefix: 'Restaurant review insight',
    quoteSource: 'Review from Google Maps',
  },
  vi: {
    eyebrow: 'Phân tích review từ Google Maps',
    searchPlaceholder: 'Dán link Google Maps của nhà hàng...',
    searchActionLabel: 'Mở luồng phân tích review nhà hàng',
    dashboardLabel: 'Dashboard nhà hàng',
    totalReviewsLabel: 'Tổng review',
    averageRatingLabel: 'Điểm trung bình',
    liveSnapshotLabel: 'Ảnh chụp review realtime',
    reviewCardTitle: 'Tín hiệu khách hàng',
    reviewCardTime: '2 phút trước',
    reviewCardQuote: '"Khách bắt đầu nhắc nhiều hơn về dịch vụ nhanh và ổn định."',
    sentimentTitle: 'Xu hướng sentiment',
    sentimentPositive: 'Tích cực hơn',
    galleryAltPrefix: 'Minh hoạ review nhà hàng',
    quoteSource: 'Review từ Google Maps',
  },
  ja: {
    eyebrow: 'Google Maps review intelligence',
    searchPlaceholder: 'Google Maps URL...',
    searchActionLabel: 'Open review flow',
    dashboardLabel: 'Restaurant dashboard',
    totalReviewsLabel: 'Total reviews',
    averageRatingLabel: 'Avg rating',
    liveSnapshotLabel: 'Live review snapshot',
    reviewCardTitle: 'Guest signal',
    reviewCardTime: '2 minutes ago',
    reviewCardQuote: '"Service mentions are trending upward after the latest changes."',
    sentimentTitle: 'Sentiment trend',
    sentimentPositive: 'Positive shift',
    galleryAltPrefix: 'Restaurant review insight',
    quoteSource: 'Review from Google Maps',
  },
}

const HERO_FEATURE_ICONS = ['travel_explore', 'insights', 'monitoring'] as const
const HERO_CHART_HEIGHTS = [32, 58, 44, 76, 56, 84, 64] as const
const HERO_REVIEW_IMAGE = '/images/Review.png'
const HERO_SOURCE_PILLS = ['Google Maps', 'Facebook', 'ShopeeFood'] as const
const HERO_LINE_COLORS = [
  'rgba(201,91,20,0.52)',
  'rgba(235,122,28,0.46)',
  'rgba(176,127,76,0.38)',
  'rgba(242,178,77,0.34)',
] as const

interface HeroAmbientLine {
  id: string
  top: string
  width: string
  height: string
  rotate: number
  opacity: number
  duration: string
  delay: string
  side: 'left' | 'right'
  offset: string
  color: string
  shadow: string
}

function createAmbientLines(side: 'left' | 'right', count: number) {
  return Array.from({ length: count }, (_, index): HeroAmbientLine => {
    const topBase = 6 + index * (82 / count)
    const topJitter = Math.random() * 10 - 2
    const width = 74 + Math.round(Math.random() * 118)
    const height = `${1.4 + Math.random() * 1.3}px`
    const rotate = (Math.random() * 56 - 28) * (side === 'left' ? 1 : -1)
    const opacity = 0.56 + Math.random() * 0.26
    const duration = `${8 + Math.random() * 8}s`
    const delay = `${Math.random() * 3}s`
    const color = HERO_LINE_COLORS[index % HERO_LINE_COLORS.length]
    const offsetBase = side === 'left' ? Math.random() * 22 : Math.random() * 22
    const shadow = `0 0 16px ${color.replace(/0\.\d+\)/, '0.18)')}`

    return {
      id: `${side}-${index}`,
      side,
      top: `${topBase + topJitter}%`,
      width: `${width}px`,
      height,
      rotate,
      opacity,
      duration,
      delay,
      offset: `${offsetBase}%`,
      color,
      shadow,
    }
  })
}

function HeroAmbientLines() {
  const lines = useMemo(
    () => [...createAmbientLines('left', 10), ...createAmbientLines('right', 10)],
    [],
  )

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {lines.map((line) => (
        <span
          key={line.id}
          className="absolute block rounded-full"
          style={{
            top: line.top,
            [line.side]: line.offset,
            width: line.width,
            height: line.height,
            opacity: line.opacity,
            background: `linear-gradient(90deg, transparent 0%, ${line.color} 14%, ${line.color} 86%, transparent 100%)`,
            boxShadow: line.shadow,
            transform: `rotate(${line.rotate}deg)`,
            transformOrigin: line.side === 'left' ? 'left center' : 'right center',
            animation: `float ${line.duration} ease-in-out ${line.delay} infinite`,
          }}
        />
      ))}
    </div>
  )
}

function HeroStatCard({
  value,
  label,
  delayMs = 0,
}: {
  value: string
  label: string
  delayMs?: number
}) {
  return (
    <div
      className="rounded-[1.65rem] border border-[#f2e5d6] bg-white/92 p-5 shadow-[0_16px_30px_-22px_rgba(49,28,11,0.14)] backdrop-blur"
      style={{
        animation: `fade-in-up 0.8s ease-out ${delayMs}ms forwards, dashboard-stat-drift 5.2s ease-in-out ${960 + delayMs}ms infinite`,
        opacity: 0,
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7a08a]">{label}</p>
      <p className="mt-2 text-[2.6rem] font-black leading-none text-[#201611] md:text-[2.95rem]">{value}</p>
    </div>
  )
}

function HeroOutlineCluster({
  className,
  outerClassName,
  middleClassName,
  innerClassName,
}: {
  className: string
  outerClassName: string
  middleClassName: string
  innerClassName: string
}) {
  return (
    <div aria-hidden className={`absolute hidden lg:block ${className}`}>
      <div
        className={`absolute rounded-[999px] border border-[#ddb889]/90 shadow-[0_0_0_1px_rgba(221,184,137,0.1)] dark:border-white/10 ${outerClassName}`}
      />
      <div
        className={`absolute rounded-[999px] border border-[#e5c69d]/88 shadow-[0_0_0_1px_rgba(229,198,157,0.08)] dark:border-white/8 ${middleClassName}`}
      />
      <div
        className={`absolute rounded-[999px] border border-[#eed7b6]/86 shadow-[0_0_0_1px_rgba(238,215,182,0.08)] dark:border-white/7 ${innerClassName}`}
      />
    </div>
  )
}

function HeroDashboardMockup({
  ui,
  compactReviewCardTitle,
  compactReviewCardTime,
  pulseTitle,
  pulseSubtitle,
  pulseFooter,
}: {
  ui: HeroVisualCopy
  compactReviewCardTitle: string
  compactReviewCardTime: string
  pulseTitle: string
  pulseSubtitle: string
  pulseFooter: string
}) {
  const pulseItems = [
    { label: 'Google Maps', value: '86', width: '86%', delay: '0ms' },
    { label: 'Facebook', value: '72', width: '72%', delay: '180ms' },
    { label: 'ShopeeFood', value: '91', width: '91%', delay: '360ms' },
  ] as const

  return (
    <div className="relative mx-auto w-full max-w-[54rem] px-2 py-6 md:px-5 md:py-8">
      <div className="pointer-events-none absolute inset-x-8 top-6 h-[31rem] rounded-[3.4rem] bg-[radial-gradient(circle,rgba(235,122,28,0.2)_0%,rgba(235,122,28,0.06)_40%,transparent_72%)] blur-[38px]" />
      <div className="pointer-events-none absolute inset-x-16 top-14 hidden h-[26rem] rounded-[3rem] border border-[#f5dcc0]/60 md:block" />
      <span className="pointer-events-none absolute left-4 top-16 hidden text-[2rem] font-light text-[#eb7a1c]/24 animate-float-slow md:block">
        +
      </span>
      <span className="pointer-events-none absolute right-10 top-8 hidden text-[1.4rem] font-light text-[#f2b24d]/35 animate-float-medium md:block">
        +
      </span>

      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
        <section className="space-y-4">
          <div className="animate-dashboard-panel relative overflow-hidden rounded-[2.8rem] border border-white/80 bg-[rgba(255,252,247,0.88)] p-6 shadow-[0_42px_96px_-46px_rgba(53,30,11,0.3)] backdrop-blur-xl md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="animate-dashboard-orb size-3 rounded-full bg-[#f67f2a]"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="animate-dashboard-orb size-3 rounded-full bg-[#efb24d]"
                  style={{ animationDelay: '180ms' }}
                />
                <span
                  className="animate-dashboard-orb size-3 rounded-full bg-[#6cc28e]"
                  style={{ animationDelay: '360ms' }}
                />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c4ae96]">
                {ui.dashboardLabel}
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <HeroStatCard value="1,240" label={ui.totalReviewsLabel} delayMs={160} />
              <HeroStatCard value="4.8" label={ui.averageRatingLabel} delayMs={240} />
            </div>

            <div
              className="animate-fade-in-up relative mt-7 overflow-hidden rounded-[2.25rem] border border-[#f4e7d8] bg-white/82 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]"
              style={{ animationDelay: '300ms', opacity: 0 }}
            >
              <span
                aria-hidden
                className="animate-dashboard-sheen pointer-events-none absolute inset-y-10 left-[-34%] w-[34%] rotate-[12deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)] blur-xl"
              />
              <div className="mb-6 flex items-center justify-between gap-4">
                <p className="text-lg font-bold text-[#3e3024]">Sentiment Over Time</p>
                <span className="animate-dashboard-pill rounded-xl bg-[#fff1df] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d96f1d]">
                  +12 %
                </span>
              </div>

              <div className="animate-dashboard-chart flex h-[15rem] items-end gap-2 rounded-[1.8rem] bg-[#fff8f1] px-4 pb-5 pt-6 md:h-[16rem]">
                {HERO_CHART_HEIGHTS.map((height, index) => (
                  <div key={`${height}-${index}`} className="flex-1 self-end" style={{ height: `${height}%` }}>
                    <div
                      className="animate-dashboard-bar-rise h-full"
                      style={{ animationDelay: `${360 + index * 90}ms`, opacity: 0 }}
                    >
                      <div
                        className={`animate-dashboard-bar-loop h-full rounded-full ${
                          index === 3 || index === HERO_CHART_HEIGHTS.length - 2
                            ? 'bg-[#e87a20]'
                            : 'bg-[#f28d2b]'
                        }`}
                        style={{ animationDelay: `${1180 + index * 120}ms` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {HERO_SOURCE_PILLS.map((pill, index) => (
                  <span
                    key={pill}
                    className="rounded-full border border-[#f0dcc4] bg-white px-4 py-2 text-[11px] font-semibold text-[#8b7259] shadow-[0_10px_18px_-16px_rgba(53,30,11,0.18)]"
                    style={{
                      animation: `fade-in-up 0.8s ease-out ${780 + index * 80}ms forwards, dashboard-chip-drift 4.8s ease-in-out ${1460 + index * 180}ms infinite`,
                      opacity: 0,
                    }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-1">
            <div className="animate-hero-card-b w-full rounded-[1.9rem] border border-[#f1e2d2] bg-white/96 p-5 shadow-[0_28px_60px_-32px_rgba(53,30,11,0.22)] backdrop-blur md:p-6">
              <p className="max-w-[34rem] text-[14px] italic leading-7 text-[#8e7761] md:text-[15px]">
                "{ui.reviewCardQuote}"
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-[#eb7a1c]">
                <span className="h-px w-5 bg-[#eb7a1c]" />
                <span>{ui.quoteSource}</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <div className="animate-hero-card-a rounded-[2rem] border border-white/85 bg-white/95 p-4 shadow-[0_28px_62px_-34px_rgba(53,30,11,0.24)] backdrop-blur">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-[#f6e8d7] bg-[radial-gradient(circle_at_24%_18%,#fffaf0_0%,#f8ecde_60%,#f0e2cf_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="pointer-events-none absolute inset-x-6 top-1 h-16 rounded-full bg-[rgba(255,255,255,0.34)] blur-2xl" />
              <img
                src={HERO_REVIEW_IMAGE}
                alt={ui.galleryAltPrefix}
                loading="lazy"
                decoding="async"
                className="relative aspect-square w-full rounded-[1.2rem] object-cover shadow-[0_18px_30px_-26px_rgba(53,30,11,0.22)]"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-0 text-[#f28d2b]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="material-symbols-outlined text-[17px] leading-none">
                    star
                  </span>
                ))}
              </div>
              <span className="rounded-lg bg-[#f7f3ed] px-2.5 py-1 text-[11px] font-bold text-[#a18668]">4.8</span>
            </div>
          </div>

          <div className="animate-hero-card-c rounded-[2rem] border border-white/85 bg-white/94 p-5 shadow-[0_26px_58px_-30px_rgba(53,30,11,0.2)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08b67]">Signal</span>
              <span className="rounded-full bg-[#fff1df] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#d96f1d]">
                {compactReviewCardTime}
              </span>
            </div>

            <p className="mt-5 text-lg font-bold leading-7 text-[#201611]">{compactReviewCardTitle}</p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="mb-1.5 flex justify-end">
                  <span className="text-[10px] font-bold text-[#d96f1d]">86%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#fde8cf]">
                  <div className="animate-dashboard-meter h-full w-[86%] rounded-full bg-[#f28d2b]" />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-end">
                  <span className="text-[10px] font-bold text-[#34c97a]">96%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#dff4e6]">
                  <div
                    className="animate-dashboard-meter h-full w-[96%] rounded-full bg-[#34c97a]"
                    style={{ animationDelay: '180ms' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="animate-hero-card-d rounded-[2rem] border border-white/85 bg-white/94 p-5 shadow-[0_26px_58px_-30px_rgba(53,30,11,0.2)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="animate-dashboard-live-dot size-2 rounded-full bg-[#34c97a]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b08b67]">{pulseTitle}</p>
              </div>
              <span className="rounded-md bg-[#fff3e6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#d96f1d]">
                Live
              </span>
            </div>

            <p className="mt-5 text-[15px] font-bold leading-6 text-[#201611]">{pulseSubtitle}</p>

            <div className="mt-6 space-y-5">
              {pulseItems.map((item) => (
                <div key={item.label} className="animate-dashboard-mini-row" style={{ animationDelay: item.delay }}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold">
                    <span className="text-[#6e5640]">{item.label}</span>
                    <span className="text-[#d96f1d]">{item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f8ebdc]">
                    <div
                      className="animate-dashboard-meter h-full rounded-full bg-[linear-gradient(90deg,#f2b24d_0%,#eb7a1c_100%)]"
                      style={{ width: item.width, animationDelay: item.delay }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a88d71]">
              <span className="h-px w-5 bg-[#e6d3bf]" />
              <span>{pulseFooter}</span>
              <span className="h-px w-5 bg-[#e6d3bf]" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function HeroSection({
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: HeroSectionProps) {
  const { copy, language } = useLanguage()
  const [draftQuery, setDraftQuery] = useState('')
  const ui = HERO_VISUAL_COPY[language]
  const compactReviewCardTitle = language === 'vi' ? 'T\u00edn hi\u1ec7u review' : ui.reviewCardTitle
  const compactReviewCardTime = language === 'vi' ? '2m tr\u01b0\u1edbc' : ui.reviewCardTime
  const pulseTitle = language === 'vi' ? 'Nh\u1ecbp review' : 'Live pulse'
  const pulseSubtitle =
    language === 'vi' ? 'Ngu\u1ed3n \u0111ang nh\u1eafc nhi\u1ec1u h\u01a1n' : 'Sources gaining traction'
  const pulseFooter = language === 'vi' ? 'C\u1eadp nh\u1eadt li\u00ean t\u1ee5c' : 'Continuous updates'
  const isVietnameseBrandLead = language === 'vi' && copy.hero.titleLine1.trim() === copy.header.brand
  const secondaryLine = isVietnameseBrandLead
    ? 'Lắng nghe. Phân tích. Cải tiến.'
    : copy.hero.titleLine2

  return (
    <section id="overview" className="relative min-h-[100svh] overflow-hidden bg-bg-light selection:bg-primary/20 dark:bg-bg-dark">
      <div className="absolute inset-0 overflow-hidden">
        <HeroAmbientLines />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff8ef_0%,#fdf0df_48%,#f8e4ca_100%)] dark:bg-[linear-gradient(135deg,#1b120b_0%,#160f09_52%,#0f0906_100%)]" />
        <div className="absolute left-[8%] top-[12%] size-[25rem] rounded-full bg-[rgba(235,122,28,0.16)] blur-[150px]" />
        <div className="absolute right-[10%] top-[18%] size-[22rem] rounded-full bg-[rgba(250,181,74,0.18)] blur-[150px]" />
        <HeroOutlineCluster
          className="left-[-6%] top-[7.75rem] h-[33rem] w-[21rem] -rotate-[11deg]"
          outerClassName="left-0 top-0 h-[31rem] w-[18rem]"
          middleClassName="left-[2.6rem] top-[1.6rem] h-[26rem] w-[14rem]"
          innerClassName="left-[5rem] top-[3rem] h-[21rem] w-[10rem]"
        />
        <HeroOutlineCluster
          className="right-[-6.5%] top-[6.75rem] h-[35rem] w-[22rem] rotate-[16deg]"
          outerClassName="right-0 top-0 h-[31rem] w-[18rem]"
          middleClassName="right-[2.6rem] top-[1.6rem] h-[26rem] w-[14rem]"
          innerClassName="right-[5rem] top-[3rem] h-[21rem] w-[10rem]"
        />
        <HeroOutlineCluster
          className="bottom-[2.5rem] left-[-3.5%] h-[18rem] w-[12rem] rotate-[15deg] opacity-80"
          outerClassName="left-0 top-0 h-[16rem] w-[9rem]"
          middleClassName="left-[1.55rem] top-[1.1rem] h-[13rem] w-[6.75rem]"
          innerClassName="left-[2.95rem] top-[2.1rem] h-[10rem] w-[4.6rem]"
        />
        <HeroOutlineCluster
          className="bottom-[2.25rem] right-[-3.75%] h-[18rem] w-[12rem] -rotate-[15deg] opacity-80"
          outerClassName="right-0 top-0 h-[16rem] w-[9rem]"
          middleClassName="right-[1.55rem] top-[1.1rem] h-[13rem] w-[6.75rem]"
          innerClassName="right-[2.95rem] top-[2.1rem] h-[10rem] w-[4.6rem]"
        />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1680px] items-center px-3 pb-24 pt-28 md:px-6 md:pb-24 lg:px-6 lg:pt-36">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:gap-10">
          <div className="relative z-10 max-w-[40rem] lg:pr-1">
            <div>
              {isVietnameseBrandLead ? (
                <h1>
                  <span className="block font-display text-[clamp(4.9rem,10vw,7.8rem)] font-black leading-[0.86] tracking-[-0.085em] text-[#201611] dark:text-white">
                    {copy.hero.titleLine1}
                  </span>
                  <span className="mt-5 block max-w-fit whitespace-nowrap font-serif text-[clamp(1.05rem,3.2vw,3.1rem)] italic leading-none text-[#e87a20]">
                    {secondaryLine}
                  </span>
                </h1>
              ) : (
                <h1 className="font-display text-[clamp(4rem,8vw,6.8rem)] font-black leading-[0.88] tracking-[-0.065em] text-[#201611] dark:text-white">
                  <span className="block">{copy.hero.titleLine1}</span>
                  <span className="mt-4 block max-w-fit whitespace-nowrap font-serif text-[0.78em] font-normal italic text-[#e87a20]">
                    {secondaryLine}
                  </span>
                </h1>
              )}

              <p className="mt-8 max-w-[38rem] text-base leading-8 text-[#715945] md:text-lg dark:text-[#ccb79b]">
                {copy.hero.description}
              </p>
            </div>

            <div className="mt-10 max-w-[38rem] rounded-[2rem] border border-[#efdcc8] bg-white/78 p-2 shadow-[0_28px_60px_-38px_rgba(53,30,11,0.24)] backdrop-blur dark:border-white/10 dark:bg-white/7">
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  onPrimaryAction()
                }}
              >
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{ui.searchPlaceholder}</span>
                  <input
                    type="text"
                    value={draftQuery}
                    onChange={(event) => setDraftQuery(event.target.value)}
                    placeholder={ui.searchPlaceholder}
                    className="w-full rounded-[1.45rem] border border-transparent bg-white px-5 py-4 pl-12 text-base text-[#201611] shadow-[inset_0_0_0_1px_rgba(138,106,74,0.12)] outline-none transition placeholder:text-[#8a6a4a]/75 focus:shadow-[inset_0_0_0_1px_rgba(232,122,32,0.42)] dark:bg-white/8 dark:text-white dark:placeholder:text-white/38"
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a6a4a] dark:text-[#ccb79b]">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                  </span>
                </label>

                <button
                  type="submit"
                  aria-label={ui.searchActionLabel}
                  className="inline-flex h-[3.6rem] items-center justify-center gap-2 rounded-[1.45rem] bg-gradient-to-r from-[#eb7a1c] to-[#d95f16] px-6 text-sm font-bold text-white shadow-[0_20px_36px_-20px_rgba(217,95,22,0.75)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-18px_rgba(217,95,22,0.85)]"
                >
                  <span>{primaryLabel}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
                </button>
              </form>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#ead4bd] bg-white/72 px-5 text-sm font-semibold text-[#201611] shadow-[0_14px_28px_-22px_rgba(53,30,11,0.18)] transition hover:border-[#eb7a1c]/40 hover:text-[#c65f17] dark:border-white/10 dark:bg-white/7 dark:text-white"
                onClick={onSecondaryAction}
              >
                {secondaryLabel}
              </button>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fff1df] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#bf6519] shadow-[0_14px_24px_-24px_rgba(53,30,11,0.14)] dark:bg-white/7 dark:text-[#f3c47f]">
                <span className="size-2 rounded-full bg-[#eb7a1c]" />
                <span>{ui.liveSnapshotLabel}</span>
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {copy.hero.highlights.map((item, index) => (
                <article
                  key={item}
                  className={`rounded-[1.7rem] border p-5 shadow-[0_22px_44px_-34px_rgba(53,30,11,0.18)] transition hover:-translate-y-1 ${
                    index === 1
                      ? 'border-[#f0d5b7] bg-[linear-gradient(160deg,rgba(255,243,224,0.95),rgba(255,232,204,0.9))]'
                      : 'border-[#f0ddc7] bg-[rgba(255,252,247,0.88)]'
                  } dark:border-white/10 dark:bg-white/7`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff1df] text-[#d96f1d]">
                      <span className="material-symbols-outlined text-[18px]">
                        {HERO_FEATURE_ICONS[index] ?? 'insights'}
                      </span>
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#bf6519]">
                        {String(index + 1).padStart(2, '0')}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#201611] dark:text-white">
                        {item}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="relative lg:pl-0">
            <HeroDashboardMockup
              ui={ui}
              compactReviewCardTitle={compactReviewCardTitle}
              compactReviewCardTime={compactReviewCardTime}
              pulseTitle={pulseTitle}
              pulseSubtitle={pulseSubtitle}
              pulseFooter={pulseFooter}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
