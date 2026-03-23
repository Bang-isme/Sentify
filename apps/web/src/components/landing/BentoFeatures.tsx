import { getLocaleWithFallback } from '../../content/localeFallback'
import { useLanguage, type Language } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  LANDING_EYEBROW_CLASS,
  LANDING_MONO_BUTTON_CLASS,
  LANDING_PANEL_CLASS,
  LANDING_PANEL_SOFT_CLASS,
  LANDING_SECTION_ACCENT_CLASS,
  LANDING_SECTION_HEADER_CLASS,
  LANDING_SECTION_HEADER_MARGIN_CLASS,
  LANDING_SECTION_TITLE_CLASS,
} from './landingVisualSystem'

type BadgeColor = 'red' | 'green' | 'blue'

const monoLabelClass = 'font-mono text-[13px] font-medium md:text-[14px] uppercase tracking-[0.1em]'

const quotePhoto =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'
const quoteAvatar =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80'

const dashboardChrome: Record<
  Language,
  {
    exportLabel: string
    liveLabel: string
    criticalPulse: string
    verifiedSamples: string
    escalation: string
    frictionPoints: string
    distribution: string
    archive: string
    accessArchive: string
    signalName: string
    signalSubline: string
    quoteRole: string
    quoteAuthor: string
    archivePrefix: string
  }
> = {
  en: {
    exportLabel: 'Export data',
    liveLabel: 'Live feed',
    criticalPulse: 'Critical pulse',
    verifiedSamples: 'Verified samples only',
    escalation: 'Priority escalation',
    frictionPoints: 'Friction points',
    distribution: 'Data distribution',
    archive: 'Global log archive',
    accessArchive: 'Access database',
    signalName: 'Signal',
    signalSubline: 'review index',
    quoteRole: 'review critic',
    quoteAuthor: 'Elena Vance',
    archivePrefix: 'TS',
  },
  vi: {
    exportLabel: 'Xuất dữ liệu',
    liveLabel: 'Trực tiếp',
    criticalPulse: 'Xung tiêu cực',
    verifiedSamples: 'Mẫu đã xác minh',
    escalation: 'Mức ưu tiên',
    frictionPoints: 'Điểm ma sát',
    distribution: 'Phân bổ tín hiệu',
    archive: 'Kho review gốc',
    accessArchive: 'Mở kho dữ liệu',
    signalName: 'Tín hiệu',
    signalSubline: 'chỉ số review',
    quoteRole: 'review gốc',
    quoteAuthor: 'Nguồn thực tế',
    archivePrefix: 'TS',
  },
  ja: {
    exportLabel: 'データ出力',
    liveLabel: 'ライブ',
    criticalPulse: '重要シグナル',
    verifiedSamples: '確認済みデータのみ',
    escalation: '優先対応',
    frictionPoints: '運営摩擦',
    distribution: 'シグナル配分',
    archive: '元レビュー記録',
    accessArchive: '元レビューを見る',
    signalName: 'シグナル',
    signalSubline: 'レビュー指標',
    quoteRole: 'レビュー原文',
    quoteAuthor: '実際のレビュー',
    archivePrefix: 'TS',
  },
}

const frictionIcons = ['timer', 'reorder', 'priority_high'] as const

const archiveAccentMap: Record<BadgeColor, string> = {
  red: 'border-[#d45a4a]/40 text-[#c25142]',
  green: 'border-[#c78955]/40 text-[#b4622f]',
  blue: 'border-[#c78955]/40 text-[#b4622f]',
}

function metricToNumber(metric: string) {
  const match = metric.match(/\d+([.,]\d+)?/)
  if (!match) return 0
  return Number(match[0].replace(',', '.'))
}

function circleOffset(radius: number, value: number) {
  const circumference = 2 * Math.PI * radius
  return circumference * (1 - value / 100)
}

export function BentoFeatures() {
  const { copy, language } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const dashboard = copy.dashboard
  const chrome = getLocaleWithFallback(dashboardChrome, language)
  const archiveItems = copy.signals.cards.slice(0, 4)
  const sentimentRows = dashboard.sentiment.rows
  const frictionRows = dashboard.overview.complaintRows.slice(0, 2)
  const maxFrictionMetric = Math.max(...frictionRows.map(([, metric]) => metricToNumber(metric)), 1)
  const leadQuote = archiveItems[0]

  return (
    <section id="dashboard" className="content-visibility-auto relative overflow-hidden py-24 lg:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(162,63,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(162,63,0,0.025)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(162,63,0,0),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(162,63,0,0),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(235,122,28,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(242,176,77,0.08),transparent_30%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full px-4 md:px-6 lg:px-10 xl:px-14">
        <div ref={ref}>
          <div
            className={`${LANDING_SECTION_HEADER_MARGIN_CLASS} flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between ${revealClass()}`}
            style={revealStyle(0)}
          >
            <div className={LANDING_SECTION_HEADER_CLASS}>
              <span className={LANDING_EYEBROW_CLASS}>
                {dashboard.eyebrow}
              </span>
              <h2 className={LANDING_SECTION_TITLE_CLASS}>
                <span className="block">{dashboard.titleLine1}</span>
                <span className={LANDING_SECTION_ACCENT_CLASS}>{dashboard.titleLine2}</span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className={`${LANDING_MONO_BUTTON_CLASS} inline-flex min-w-[10rem] justify-center border-[#e6d8ca] bg-white/50 text-[#705d50] hover:bg-white/75 dark:border-white/10 dark:bg-white/5 dark:text-[#d7c3ab] dark:hover:bg-white/10`}>
                {chrome.exportLabel}
              </button>
              <button className={`${LANDING_MONO_BUTTON_CLASS} inline-flex min-w-[10rem] justify-center border-[#c97d48] bg-[#fff4eb] text-[#a64809] shadow-[0_4px_12px_rgba(162,63,0,0.12)] hover:bg-[#ffeedf] dark:border-[#9c5b31] dark:bg-[#2a1a11] dark:text-[#f0b37a] dark:hover:bg-[#342117]`}>
                {chrome.liveLabel}
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-12 gap-5 lg:gap-6 ${revealClass()}`} style={revealStyle(120)}>
            <div className="col-span-12 xl:col-span-8 grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6">
              <MetricCard
                icon="visibility"
                label={dashboard.overview.kpis[0]?.[1] ?? ''}
                value={dashboard.overview.kpis[0]?.[0] ?? ''}
                note={dashboard.overview.recentMovementLabel}
              />
              <MetricCard
                label={dashboard.overview.kpis[1]?.[1] ?? ''}
                value={dashboard.overview.kpis[1]?.[0] ?? ''}
                suffix="/ 5.0"
                note={chrome.verifiedSamples}
                accent="primary"
              />
              <MetricCard
                label={chrome.criticalPulse}
                value={dashboard.overview.kpis[2]?.[0] ?? ''}
                note={chrome.escalation}
                accent="critical"
              />

              <DistributionCard
                rows={sentimentRows}
                title={chrome.distribution}
                signalName={chrome.signalName}
                signalSubline={chrome.signalSubline}
              />
            </div>

            <div className="col-span-12 space-y-5 xl:col-span-4 lg:space-y-6">
              <aside className={`${LANDING_PANEL_CLASS} p-9`}>
                <h3 className={`mb-8 flex items-center gap-2 text-[#655447] dark:text-[#d9c4aa] ${monoLabelClass}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c1713d]" />
                  {chrome.frictionPoints}
                </h3>
                <div className="space-y-8">
                  {frictionRows.map(([label, metric], index) => {
                    const value = metricToNumber(metric)
                    const width = (value / maxFrictionMetric) * 100
                    const icon = frictionIcons[index] ?? 'priority_high'
                    const accent = index === 0 ? 'text-[#d45a4a] border-[#e7d4cf]' : 'text-[#b45a1a] border-[#eadbcb]'
                    const barColor = index === 0 ? 'bg-[#e79b92]' : 'bg-[#d59565]'

                    return (
                      <div key={label} className="flex items-start gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-[0.3rem] border bg-white/55 dark:bg-white/5 ${accent}`}>
                          <span className="material-symbols-outlined text-[1.3rem]">{icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <p className={`text-[#2b211b] dark:text-[#fff1e2] ${monoLabelClass}`}>{label}</p>
                            <p className="text-[13px] font-mono font-medium uppercase tracking-[0.04em] text-[#7d6758] dark:text-[#ccb59a] md:text-[14px]">{metric}</p>
                          </div>
                          <div className="h-1 w-full overflow-hidden bg-[#eee4da] dark:bg-[#342820]">
                            <div className={`h-full ${barColor}`} style={{ width: `${Math.max(width, 20)}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </aside>

              <QuoteCard
                quote={leadQuote?.description ?? dashboard.trend.description}
                imageSrc={quotePhoto}
                avatarSrc={quoteAvatar}
                author={chrome.quoteAuthor}
                role={chrome.quoteRole}
              />
            </div>

            <ArchiveCard title={chrome.archive} actionLabel={chrome.accessArchive} prefix={chrome.archivePrefix} items={archiveItems} />
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
  note,
  suffix,
  accent = 'default',
}: {
  icon?: string
  label: string
  value: string
  note: string
  suffix?: string
  accent?: 'default' | 'primary' | 'critical'
}) {
  const toneClass =
    accent === 'critical'
      ? 'border-[#f0cfc8] bg-[#fff9f8]/95 text-[#d45a4a] dark:border-[#5d2d28] dark:bg-[#261613]/92'
      : 'border-[#e7d9cb]/85 bg-white/72 text-[#1f1a17] dark:border-white/10 dark:bg-[#1a130f]/78 dark:text-[#fff7ef]'
  const noteClass =
    accent === 'critical'
      ? 'text-[#bf6c61] dark:text-[#e9a59a]'
      : accent === 'primary'
        ? 'text-[#af5d25] dark:text-[#f0b37a]'
        : 'text-[#866f61] dark:text-[#ccb59a]'

  return (
    <article className={`${LANDING_PANEL_CLASS} relative overflow-hidden p-8 ${toneClass}`}>
      {icon ? (
        <div className="absolute right-3 top-3 opacity-10">
          <span className="material-symbols-outlined text-5xl">{icon}</span>
        </div>
      ) : null}
      <p className={`${monoLabelClass} mb-5 ${accent === 'critical' ? 'text-[#d06759] dark:text-[#f0b1a8]' : 'text-[#786458] dark:text-[#ccb59a]'}`}>{label}</p>
      <div className="flex items-end gap-2">
        <h3 className={`text-[3.9rem] leading-none md:text-[4.35rem] ${accent === 'critical' ? 'text-[#d64535] dark:text-[#ff8f81]' : accent === 'primary' ? 'text-[#a23f00] dark:text-[#f3a04d]' : 'text-[#1f1a17] dark:text-[#fff7ef]'}`}>
          {value}
        </h3>
        {suffix ? <span className="pb-2 text-[17px] font-mono text-[#8f7a6e] dark:text-[#ccb59a]">{suffix}</span> : null}
      </div>
      <div className={`mt-5 flex items-center gap-2 text-[14px] md:text-[15px] font-mono font-medium uppercase tracking-[0.04em] ${noteClass}`}>
        {accent === 'default' ? <span className="material-symbols-outlined text-lg">trending_up</span> : null}
        <span>{note}</span>
      </div>
    </article>
  )
}

function DistributionCard({
  rows,
  title,
  signalName,
  signalSubline,
}: {
  rows: Array<{ label: string; value: number }>
  title: string
  signalName: string
  signalSubline: string
}) {
  const positive = rows[0]?.value ?? 0
  const neutral = rows[1]?.value ?? 0
  const negative = rows[2]?.value ?? 0

  return (
    <article className={`${LANDING_PANEL_CLASS} p-10 md:col-span-3`}>
      <div className="flex flex-col gap-12 md:flex-row md:items-center">
        <div className="w-full md:w-1/2">
          <h3 className={`mb-8 border-l border-[#c1713d] pl-3 text-[#5d4a3e] dark:text-[#d9c4aa] ${monoLabelClass}`}>{title}</h3>
          <div className="space-y-6">
            {rows.map((row, index) => {
              const valueColor = index === 0 ? 'text-[#a23f00]' : index === 1 ? 'text-[#9d938a]' : 'text-[#d45a4a]'
              const barColor = index === 0 ? 'bg-[#a23f00]' : index === 1 ? 'bg-[#cfc4ba]' : 'bg-[#d9796b]'

              return (
                <div key={row.label} className="space-y-2">
                  <div className="flex justify-between gap-4 font-mono text-[13px] font-medium md:text-[14px] uppercase tracking-[0.04em]">
                    <span className="text-[#725f53] dark:text-[#ccb59a]">{row.label}</span>
                    <span className={`font-semibold ${valueColor}`}>{row.value.toFixed(2)}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#eee6dd] dark:bg-[#342820]">
                    <div className={`h-full ${barColor}`} style={{ width: `${row.value}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex w-full justify-center md:w-1/2">
          <div className="relative flex h-64 w-64 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 224 224">
              <circle cx="112" cy="112" r="90" fill="transparent" stroke="rgba(214,199,184,0.7)" strokeWidth="1" />
              <circle
                cx="112"
                cy="112"
                r="90"
                fill="transparent"
                stroke="#a23f00"
                strokeDasharray={2 * Math.PI * 90}
                strokeDashoffset={circleOffset(90, positive)}
                strokeLinecap="butt"
                strokeWidth="6"
              />
              <circle
                cx="112"
                cy="112"
                r="75"
                fill="transparent"
                stroke="rgba(203,191,179,0.9)"
                strokeDasharray={2 * Math.PI * 75}
                strokeDashoffset={circleOffset(75, neutral)}
                strokeLinecap="butt"
                strokeWidth="2"
              />
              <circle
                cx="112"
                cy="112"
                r="60"
                fill="transparent"
                stroke="rgba(217,121,107,0.34)"
                strokeDasharray={2 * Math.PI * 60}
                strokeDashoffset={circleOffset(60, negative)}
                strokeLinecap="butt"
                strokeWidth="4"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-serif text-[2.9rem] text-[#3b2c22] dark:text-[#fff1e2] md:text-[3.15rem]">{signalName}</span>
              <span className="mt-1 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[#b5662d] dark:text-[#f0b37a] md:text-[14px]">{signalSubline}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function QuoteCard({
  quote,
  imageSrc,
  avatarSrc,
  author,
  role,
}: {
  quote: string
  imageSrc: string
  avatarSrc: string
  author: string
  role: string
}) {
  return (
    <article className={`relative min-h-[248px] overflow-hidden p-8 ${LANDING_PANEL_SOFT_CLASS}`}>
      <img
        src={imageSrc}
        alt="Dashboard atmosphere"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-10 grayscale transition-transform duration-1000"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#fcfaf7] via-[#fcfaf7]/70 to-transparent dark:from-[#1b1410] dark:via-[#1b1410]/74 dark:to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end">
        <blockquote className="border-l border-[#c1713d] pl-4 font-serif text-[1.25rem] leading-9 italic text-[#4d3d32] dark:text-[#f2e4d6] md:text-[1.4rem]">
          "{quote}"
        </blockquote>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-7 w-7 overflow-hidden rounded-full border border-[#d9c7b8] grayscale dark:border-white/15">
            <img src={avatarSrc} alt={author} loading="lazy" className="h-full w-full object-cover" />
          </div>
          <p className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[#7f6b5f] dark:text-[#ccb59a] md:text-[14px]">
            {author} // {role}
          </p>
        </div>
      </div>
    </article>
  )
}

function ArchiveCard({
  title,
  actionLabel,
  prefix,
  items,
}: {
  title: string
  actionLabel: string
  prefix: string
  items: Array<{
    badge: { text: string; color: BadgeColor } | null
    title: string
    metric: string
  }>
}) {
  return (
    <article className={`${LANDING_PANEL_CLASS} col-span-12 mt-1 p-10`}>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h3 className={`text-[#2d241f] dark:text-[#fff1e2] ${monoLabelClass}`}>{title}</h3>
        <span className={`${LANDING_MONO_BUTTON_CLASS} inline-flex min-w-[10rem] justify-center border-[#d8b79e] px-3 py-2 text-[#a95318] dark:border-[#885937] dark:text-[#f0b37a]`}>
          {actionLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const accent =
            item.badge?.color != null ? archiveAccentMap[item.badge.color] : 'border-[#c78955]/40 text-[#b4622f]'

          return (
            <div key={item.title} className={`border-l bg-[#fcfaf7]/55 p-5 transition-colors hover:bg-[#fcfaf7]/80 dark:bg-[#130f0c]/72 dark:hover:bg-[#19130f] ${accent}`}>
              <div className="mb-2 flex gap-0.5">
                {Array.from({ length: Math.min(index + 2, 4) }).map((_, starIndex) => (
                  <span
                    key={`${item.title}-${starIndex}`}
                    className="material-symbols-outlined text-[13px]"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'opsz' 24" }}
                  >
                    star
                  </span>
                ))}
              </div>
              <p className="font-serif text-[16px] leading-7 text-[#4f4035] dark:text-[#f2e4d6] md:text-[18px]">"{item.title}"</p>
              <p className="mt-2 font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-[#7f6b5f] dark:text-[#ccb59a] md:text-[14px]">
                {prefix}: {item.metric} // {item.badge?.text ?? 'review'}
              </p>
            </div>
          )
        })}
      </div>
    </article>
  )
}
