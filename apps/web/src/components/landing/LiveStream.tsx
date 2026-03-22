import { useLanguage, type Language } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const editorialPhotos = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
] as const

const editorialCopy: Record<
  Language,
  {
    titleLine1: string
    titleLine2: string
    detailLabel: string
    tileLabels: [string, string, string, string]
    tileTitles: [string, string, string, string]
    tileNotes: [string, string, string, string]
    recommendationEyebrow: string
    recommendationTitle: string
    recommendationLabels: [string, string]
    quote: string
    quoteAuthor: string
    quoteRole: string
  }
> = {
  en: {
    titleLine1: 'Signals worth',
    titleLine2: 'acting on next.',
    detailLabel: 'Details',
    tileLabels: ['Guest friction', 'Service quality', 'Packaging', 'Recovery trend'],
    tileTitles: ['Wait Time', 'Service Quality', 'Packaging', 'Recovery Pace'],
    tileNotes: ['Primary issue', 'Verified signal', 'Needs watching', 'Positive shift'],
    recommendationEyebrow: "The team's recommendation",
    recommendationTitle: 'Strategic Advisory',
    recommendationLabels: ['Highest impact pattern', 'Secondary watchpoint'],
    quote:
      '“A useful signal is not another dashboard layer. It is a clear indication of what the team should fix first, and what should be monitored next.”',
    quoteAuthor: 'Sentify Framework',
    quoteRole: 'Operational signal layer',
  },
  vi: {
    titleLine1: 'Tín hiệu đáng',
    titleLine2: 'được xử lý ngay.',
    detailLabel: 'Chi tiết',
    tileLabels: ['Điểm nghẽn', 'Chất lượng dịch vụ', 'Đóng gói', 'Đà phục hồi'],
    tileTitles: ['Chờ lâu', 'Chất lượng phục vụ', 'Đóng gói', 'Đà cải thiện'],
    tileNotes: ['Điểm nghẽn chính', 'Đã xác minh', 'Cần theo dõi', 'Tăng trở lại'],
    recommendationEyebrow: 'Khuyến nghị từ nhóm',
    recommendationTitle: 'Ưu tiên chiến lược',
    recommendationLabels: ['Ưu tiên tác động lớn', 'Tín hiệu cần theo dõi tiếp'],
    quote:
      '“Tín hiệu tốt không phải là thêm biểu đồ. Tín hiệu tốt là chỉ ra rõ đội ngũ nên xử lý gì trước, rồi theo dõi xem nó có thực sự cải thiện hay không.”',
    quoteAuthor: 'Khung vận hành Sentify',
    quoteRole: 'Lớp tín hiệu vận hành',
  },
  ja: {
    titleLine1: 'Signals worth',
    titleLine2: 'acting on next.',
    detailLabel: 'Details',
    tileLabels: ['Guest friction', 'Service quality', 'Packaging', 'Recovery trend'],
    tileTitles: ['Wait Time', 'Service Quality', 'Packaging', 'Recovery Pace'],
    tileNotes: ['Primary issue', 'Verified signal', 'Needs watching', 'Positive shift'],
    recommendationEyebrow: "The team's recommendation",
    recommendationTitle: 'Strategic Advisory',
    recommendationLabels: ['Highest impact pattern', 'Secondary watchpoint'],
    quote:
      '“A useful signal is not another dashboard layer. It is a clear indication of what the team should fix first, and what should be monitored next.”',
    quoteAuthor: 'Sentify Framework',
    quoteRole: 'Operational signal layer',
  },
}

function splitMetric(metric: string) {
  const match = metric.trim().match(/^([+-]?\d+(?:[.,]\d+)?)(.*)$/)

  if (!match) {
    return { value: metric, suffix: '' }
  }

  return {
    value: match[1],
    suffix: match[2].trim(),
  }
}

export function LiveStream() {
  const { copy, language } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const ui = editorialCopy[language]

  const primarySignal = copy.signals.cards[0]
  const qualitySignal = copy.signals.cards[1]
  const packagingSignal = copy.signals.cards[2]
  const trendSignal = copy.signals.cards[3]
  const avgRating = copy.dashboard.overview.kpis[1]?.[0] ?? '4.2'

  const signalTiles = [
    {
      label: ui.tileLabels[0],
      title: ui.tileTitles[0],
      note: ui.tileNotes[0],
      imageSrc: editorialPhotos[0],
      imageAlt: primarySignal?.title ?? ui.tileTitles[0],
      metric: splitMetric(primarySignal?.metric ?? '18 mentions'),
      icon: primarySignal?.icon ?? 'schedule',
    },
    {
      label: ui.tileLabels[1],
      title: ui.tileTitles[1],
      note: ui.tileNotes[1],
      imageSrc: editorialPhotos[1],
      imageAlt: qualitySignal?.title ?? ui.tileTitles[1],
      metric: splitMetric(avgRating),
      icon: qualitySignal?.icon ?? 'mood',
    },
    {
      label: ui.tileLabels[2],
      title: ui.tileTitles[2],
      note: ui.tileNotes[2],
      imageSrc: editorialPhotos[2],
      imageAlt: packagingSignal?.title ?? ui.tileTitles[2],
      metric: splitMetric(packagingSignal?.metric ?? '11 mentions'),
      icon: packagingSignal?.icon ?? 'inventory_2',
    },
    {
      label: ui.tileLabels[3],
      title: ui.tileTitles[3],
      note: ui.tileNotes[3],
      imageSrc: editorialPhotos[3],
      imageAlt: trendSignal?.title ?? ui.tileTitles[3],
      metric: splitMetric(trendSignal?.metric ?? '+9 pts'),
      icon: trendSignal?.icon ?? 'trending_up',
    },
  ] as const

  const recommendationItems = [
    {
      icon: primarySignal?.icon ?? 'schedule',
      label: ui.recommendationLabels[0],
      title: primarySignal?.title ?? ui.tileTitles[0],
      description: primarySignal?.description ?? '',
    },
    {
      icon: packagingSignal?.icon ?? 'inventory_2',
      label: ui.recommendationLabels[1],
      title: packagingSignal?.title ?? ui.tileTitles[2],
      description: packagingSignal?.description ?? trendSignal?.description ?? '',
    },
  ] as const

  return (
    <section id="signals" className="content-visibility-auto relative overflow-hidden bg-transparent py-24 lg:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-[8%] top-0 h-[26rem] rounded-full bg-[radial-gradient(circle,rgba(162,63,0,0.07)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 md:px-10">
        <div ref={ref}>
          <header className={`mb-14 max-w-[52rem] ${revealClass()}`} style={revealStyle(0)}>
            <div>
              <span className="block text-[12px] font-bold uppercase tracking-[0.32em] text-primary sm:text-[13px] xl:text-[14px]">
                {copy.signals.eyebrow}
              </span>
              <h2 className="mt-4 font-serif text-[clamp(3rem,6vw,5rem)] font-normal leading-[0.94] tracking-tight text-[#2c211b] dark:text-[#fff7ef]">
                <span className="block">{ui.titleLine1}</span>
                <span className="block italic text-[#8f7562] dark:text-[#d8c1a6]">{ui.titleLine2}</span>
              </h2>
            </div>
          </header>

          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 ${revealClass()}`} style={revealStyle(120)}>
            {signalTiles.map((tile) => (
              <article key={tile.title} className="group">
                <div className="relative h-[29rem] overflow-hidden rounded-[1.1rem] bg-[#1b1511] shadow-[0_20px_48px_rgba(44,23,10,0.08)]">
                  <img
                    src={tile.imageSrc}
                    alt={tile.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,12,9,0.12)_0%,rgba(17,12,9,0.28)_36%,rgba(17,12,9,0.92)_100%)]" />

                  <div className="absolute inset-x-5 top-5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(243,160,77,0.14)] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#f1b172] backdrop-blur-sm">
                      <span className="material-symbols-outlined text-[16px]">{tile.icon}</span>
                      {tile.label}
                    </span>
                  </div>

                  <div className="absolute inset-x-5 bottom-5">
                    <h3 className="max-w-[12rem] font-serif text-[1.9rem] leading-[1.02] text-white">
                      {tile.title}
                    </h3>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="font-serif text-[3.6rem] font-bold leading-none text-white">{tile.metric.value}</span>
                      {tile.metric.suffix ? (
                        <span className="pb-2 text-[1.15rem] font-medium text-[#efe0d5]">{tile.metric.suffix}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[14px] font-medium text-[#e9d9cc]/82">{tile.note}</p>

                    <button
                      type="button"
                      className="mt-5 inline-flex rounded-[0.8rem] bg-white/10 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-sm ring-1 ring-white/16 transition-colors hover:bg-white/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {ui.detailLabel}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div
            className={`mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.04fr_0.96fr] ${revealClass()}`}
            style={revealStyle(240)}
          >
            <article className="rounded-[1.15rem] bg-[#f4ede4]/86 p-7 shadow-[0_16px_44px_rgba(68,34,11,0.05)] dark:bg-[#201610]/78 dark:ring-1 dark:ring-white/8 md:p-8">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary md:text-[13px]">
                {ui.recommendationEyebrow}
              </span>
              <h3 className="mt-4 font-serif text-[2rem] leading-tight text-[#2f241d] dark:text-[#fff7ef]">
                {ui.recommendationTitle}
              </h3>

              <div className="mt-7 space-y-5">
                {recommendationItems.map((item, index) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <span className="text-[13px] font-bold">{index + 1}</span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#9b7d67] dark:text-[#d8c1a6] md:text-[13px]">
                        {item.label}
                      </p>
                      <h4 className="mt-1 font-serif text-[1.45rem] leading-tight text-[#33271f] dark:text-[#fff7ef]">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-[15px] leading-7 text-[#6f5a4a] dark:text-[#ccb59a]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[1.15rem] bg-white/74 p-7 shadow-[0_16px_44px_rgba(68,34,11,0.04)] ring-1 ring-outline-variant/20 md:p-8 dark:bg-[#19120e]/84">
              <div className="flex h-full flex-col justify-between">
                <blockquote className="max-w-[28rem] font-serif text-[2rem] italic leading-[1.45] text-[#3a2d24] dark:text-[#fff7ef]">
                  {ui.quote}
                </blockquote>

                <div className="mt-10 flex items-center gap-4">
                  <div className="h-px w-12 bg-primary" />
                  <div>
                    <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-primary">{ui.quoteAuthor}</p>
                    <p className="mt-1 text-[14px] uppercase tracking-[0.16em] text-[#8a7566] dark:text-[#ccb59a]">
                      {ui.quoteRole}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
