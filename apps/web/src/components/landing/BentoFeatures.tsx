import type { CSSProperties } from 'react'
import { getLocaleWithFallback } from '../../content/localeFallback'
import { useLanguage, type Language } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  LANDING_BODY_CLASS,
  LANDING_EYEBROW_CLASS,
  LANDING_SECTION_ACCENT_CLASS,
  LANDING_SECTION_HEADER_CLASS,
  LANDING_SECTION_HEADER_MARGIN_CLASS,
  LANDING_SECTION_TITLE_CLASS,
} from './landingVisualSystem'

type MetricCard = {
  label: string
  value: string
  note: string
  delta?: string
  stars?: number
}

type FeedEntry = {
  quote: string
  author: string
  time: string
  rating: number
}

type StaffMember = {
  name: string
  role: string
  note: string
  image: string
  accent: 'green' | 'orange'
}

type DashboardShowcaseCopy = {
  chartTitle: string
  liveFeedTitle: string
  staffTitle: string
  staffAction: string
  legend: {
    positive: string
    neutral: string
    negative: string
  }
  metrics: MetricCard[]
  feed: FeedEntry[]
  staff: StaffMember[]
  days: string[]
}

const panelClass =
  'rounded-[1.15rem] border border-[#eee2d4] bg-white/92 shadow-[0_1rem_2.2rem_rgba(68,34,11,0.042)] dark:border-white/10 dark:bg-[#18120e]/84 dark:shadow-[0_1.3rem_2.8rem_rgba(0,0,0,0.34)]'

const softInnerClass =
  'rounded-[0.95rem] border border-[#f2e7da] bg-[#fcfaf7]/96 dark:border-white/8 dark:bg-[#211812]/82'

const kpiLabelClass =
  'text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#736153] dark:text-[#ccb59a] md:text-[0.75rem]'

const kpiValueClass =
  'font-serif text-[2rem] font-bold leading-none text-[#2b211b] dark:text-[#fff3e6] md:text-[2.2rem]'

const monoMetaClass =
  'text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#8a7568] dark:text-[#bda48a] md:text-[0.75rem]'

const numericClass = 'tabular-nums lining-nums'

const chartColumns = [
  { positive: 60, neutral: 20, negative: 10 },
  { positive: 75, neutral: 15, negative: 5 },
  { positive: 55, neutral: 28, negative: 12 },
  { positive: 82, neutral: 10, negative: 4 },
  { positive: 68, neutral: 20, negative: 8 },
  { positive: 88, neutral: 7, negative: 3 },
  { positive: 80, neutral: 12, negative: 5 },
]

const dashboardShowcaseCopy: Record<Language, DashboardShowcaseCopy> = {
  en: {
    chartTitle: 'Guest Sentiment Trends',
    liveFeedTitle: 'Live Feed',
    staffTitle: 'Staff Performance',
    staffAction: 'View Full Roster',
    legend: {
      positive: 'Positive',
      neutral: 'Neutral',
      negative: 'Negative',
    },
    metrics: [
      {
        label: 'Total Revenue',
        value: '$42,850.00',
        note: 'Growth compared to previous Sunday',
        delta: '+12.5%',
      },
      {
        label: 'Table Occupancy',
        value: '88.4%',
        note: 'Peak: 7:00 PM – 9:30 PM',
      },
      {
        label: 'Average Rating',
        value: '4.9/5',
        note: 'Based on 1,240 reviews',
        stars: 5,
      },
    ],
    feed: [
      {
        quote: 'The truffle risotto was sublime. Exceptional service from the staff.',
        author: 'Elena R.',
        time: '2 min ago',
        rating: 5,
      },
      {
        quote:
          "Wait time was a bit longer than expected but the sommelier's pairing was perfect.",
        author: 'Marc D.',
        time: '14 min ago',
        rating: 4,
      },
      {
        quote: 'Unforgettable evening. The atmosphere is as exquisite as the plating.',
        author: 'Julian S.',
        time: '1 hr ago',
        rating: 5,
      },
    ],
    staff: [
      {
        name: 'Sarah Mitchell',
        role: 'Head Server',
        note: 'High Retention',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDMRN7iiGXqehzRz6NrUZtPsScUfX50kYdz7CA_aiyMzMtfgI0SdLzv6PtxIP_3AWnY9Kq7bD3TWKME6awjXwFeN2zd_DOAiJo8amjGeXJ279GyrNccgzwbCe5iKJcJEPKRpeEnL3KhYZTSwApgPjq0iNkN8JcAJTTwHbIyb5J7IfbNmhJkBtEuEk0c872xkYr3_TIUJAgxC6hntwCcPkYqJGQGlCtQdgVr24Rb1jNxNgdQU8SG-YbOknGemb5aFqGELh3LTgFkog',
        accent: 'green',
      },
      {
        name: 'Jean-Claude',
        role: 'Sommelier',
        note: 'Wine Sales Peak',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDOOy5MPPoazkpBqB7euuzwTbWJ9Ukr7UNl2_vf3QrhvlkP5A8BVZ2GJIWMtszv2HC1Uu7FUFVOSVCWFPgfnjdNoBYnN0lgvs6uwWVOaXdkIxC5AO0SYY4QhznffWyRyzFOEACS9NO2L-irj1rf2sM9zZispazejA60fR3nxkIOeHF7ov2aT725WNb-vNdmJyKUyzKYedoEerv8ArWFoOqaEhq51os457_VSRVu9u08ysrvfD72kM96XoTmgK2e4J0IQVUDezFdbw',
        accent: 'green',
      },
      {
        name: 'Marcus V.',
        role: 'Sous Chef',
        note: 'Efficiency Leader',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCsmoNLSDD1pfMcoi0ZOcYvMZdgCK_w_NAGQqdIKnDlpAAY_tC6459INqmURkuS1nIuswntfufO273B2x04Qu-KeXI_UyL3jl8M9mzLszSlBuM7Z_BYCnldw3eyPrlIFupan0747upXhRK9GXKkZjCKDc4ygxbkWSYHk7ui7pAK9UQY0jytIpPqSHyL7yfTqCSrqhmXRmjDvo0CTKaBV_nSCRlm_CZ9F5D8aXcTKGninF9kXZYkMrWTt8PotaIrYUdYTExQNsMvGQ',
        accent: 'orange',
      },
      {
        name: 'Andre T.',
        role: 'Floor Manager',
        note: 'Top Coordination',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBdSr_xdPa5UB4GdC4AmMGkCQva65g7oFz8jR-496WpGkB6bjoqK5o6L4kGH5C1EyK_lhw82zgFFFY8A6JLhyOim_feLrzWztvmDjcWVJ2XhVmsXr4QzOVjYLRzrg4o0HANFRPSoHVKsSKiEuN0p0tIvtQbY1D12uGCNCE8o7NPkZ_qg8MVlT9hyR5n0GRq9PsqzM2dimsRZWwfa67L-p5PQkxlKujegBFKue3RsGdh6NRJuWF72R_x3PuAx49jd4rQs9XZfEWxnw',
        accent: 'green',
      },
    ],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  vi: {
    chartTitle: 'Xu hướng cảm xúc của khách',
    liveFeedTitle: 'Live Feed',
    staffTitle: 'Hiệu suất đội ngũ',
    staffAction: 'Xem đầy đủ',
    legend: {
      positive: 'Tích cực',
      neutral: 'Trung lập',
      negative: 'Tiêu cực',
    },
    metrics: [
      {
        label: 'Tổng doanh thu',
        value: '$42,850.00',
        note: 'Tăng so với Chủ nhật trước',
        delta: '+12.5%',
      },
      {
        label: 'Lấp đầy bàn',
        value: '88.4%',
        note: 'Cao điểm: 7:00 PM – 9:30 PM',
      },
      {
        label: 'Điểm trung bình',
        value: '4.9/5',
        note: 'Dựa trên 1,240 review',
        stars: 5,
      },
    ],
    feed: [
      {
        quote: 'Risotto nấm truffle rất tốt. Đội ngũ phục vụ cũng được nhắc đến nhiều.',
        author: 'Elena R.',
        time: '2 phút trước',
        rating: 5,
      },
      {
        quote: 'Khách chờ lâu hơn kỳ vọng một chút, nhưng phần pairing của sommelier được khen rõ.',
        author: 'Marc D.',
        time: '14 phút trước',
        rating: 4,
      },
      {
        quote: 'Bầu không khí rất tốt. Khách cũng nhắc đến cách bày món như một điểm cộng.',
        author: 'Julian S.',
        time: '1 giờ trước',
        rating: 5,
      },
    ],
    staff: [
      {
        name: 'Sarah Mitchell',
        role: 'Head Server',
        note: 'Giữ chân khách tốt',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDMRN7iiGXqehzRz6NrUZtPsScUfX50kYdz7CA_aiyMzMtfgI0SdLzv6PtxIP_3AWnY9Kq7bD3TWKME6awjXwFeN2zd_DOAiJo8amjGeXJ279GyrNccgzwbCe5iKJcJEPKRpeEnL3KhYZTSwApgPjq0iNkN8JcAJTTwHbIyb5J7IfbNmhJkBtEuEk0c872xkYr3_TIUJAgxC6hntwCcPkYqJGQGlCtQdgVr24Rb1jNxNgdQU8SG-YbOknGemb5aFqGELh3LTgFkog',
        accent: 'green',
      },
      {
        name: 'Jean-Claude',
        role: 'Sommelier',
        note: 'Bán rượu nổi bật',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDOOy5MPPoazkpBqB7euuzwTbWJ9Ukr7UNl2_vf3QrhvlkP5A8BVZ2GJIWMtszv2HC1Uu7FUFVOSVCWFPgfnjdNoBYnN0lgvs6uwWVOaXdkIxC5AO0SYY4QhznffWyRyzFOEACS9NO2L-irj1rf2sM9zZispazejA60fR3nxkIOeHF7ov2aT725WNb-vNdmJyKUyzKYedoEerv8ArWFoOqaEhq51os457_VSRVu9u08ysrvfD72kM96XoTmgK2e4J0IQVUDezFdbw',
        accent: 'green',
      },
      {
        name: 'Marcus V.',
        role: 'Sous Chef',
        note: 'Hiệu suất bếp cao',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCsmoNLSDD1pfMcoi0ZOcYvMZdgCK_w_NAGQqdIKnDlpAAY_tC6459INqmURkuS1nIuswntfufO273B2x04Qu-KeXI_UyL3jl8M9mzLszSlBuM7Z_BYCnldw3eyPrlIFupan0747upXhRK9GXKkZjCKDc4ygxbkWSYHk7ui7pAK9UQY0jytIpPqSHyL7yfTqCSrqhmXRmjDvo0CTKaBV_nSCRlm_CZ9F5D8aXcTKGninF9kXZYkMrWTt8PotaIrYUdYTExQNsMvGQ',
        accent: 'orange',
      },
      {
        name: 'Andre T.',
        role: 'Floor Manager',
        note: 'Điều phối nổi bật',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBdSr_xdPa5UB4GdC4AmMGkCQva65g7oFz8jR-496WpGkB6bjoqK5o6L4kGH5C1EyK_lhw82zgFFFY8A6JLhyOim_feLrzWztvmDjcWVJ2XhVmsXr4QzOVjYLRzrg4o0HANFRPSoHVKsSKiEuN0p0tIvtQbY1D12uGCNCE8o7NPkZ_qg8MVlT9hyR5n0GRq9PsqzM2dimsRZWwfa67L-p5PQkxlKujegBFKue3RsGdh6NRJuWF72R_x3PuAx49jd4rQs9XZfEWxnw',
        accent: 'green',
      },
    ],
    days: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  },
  ja: {
    chartTitle: 'ゲスト感情の推移',
    liveFeedTitle: 'ライブフィード',
    staffTitle: 'スタッフパフォーマンス',
    staffAction: '一覧を見る',
    legend: {
      positive: 'ポジティブ',
      neutral: '中立',
      negative: 'ネガティブ',
    },
    metrics: [
      {
        label: '総売上',
        value: '$42,850.00',
        note: '前回の日曜比で上昇',
        delta: '+12.5%',
      },
      {
        label: '客席稼働率',
        value: '88.4%',
        note: 'ピーク: 7:00 PM – 9:30 PM',
      },
      {
        label: '平均評価',
        value: '4.9/5',
        note: '1,240件のレビューに基づく',
        stars: 5,
      },
    ],
    feed: [
      {
        quote: 'トリュフリゾットが素晴らしく、サービスも高く評価されています。',
        author: 'Elena R.',
        time: '2分前',
        rating: 5,
      },
      {
        quote: '待ち時間はやや長めでしたが、ソムリエのペアリングが強く好評です。',
        author: 'Marc D.',
        time: '14分前',
        rating: 4,
      },
      {
        quote: '空間演出と盛り付けの両方が印象的だったという声が目立ちます。',
        author: 'Julian S.',
        time: '1時間前',
        rating: 5,
      },
    ],
    staff: [
      {
        name: 'Sarah Mitchell',
        role: 'ヘッドサーバー',
        note: '再訪好感度が高い',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDMRN7iiGXqehzRz6NrUZtPsScUfX50kYdz7CA_aiyMzMtfgI0SdLzv6PtxIP_3AWnY9Kq7bD3TWKME6awjXwFeN2zd_DOAiJo8amjGeXJ279GyrNccgzwbCe5iKJcJEPKRpeEnL3KhYZTSwApgPjq0iNkN8JcAJTTwHbIyb5J7IfbNmhJkBtEuEk0c872xkYr3_TIUJAgxC6hntwCcPkYqJGQGlCtQdgVr24Rb1jNxNgdQU8SG-YbOknGemb5aFqGELh3LTgFkog',
        accent: 'green',
      },
      {
        name: 'Jean-Claude',
        role: 'ソムリエ',
        note: 'ワイン売上が好調',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDOOy5MPPoazkpBqB7euuzwTbWJ9Ukr7UNl2_vf3QrhvlkP5A8BVZ2GJIWMtszv2HC1Uu7FUFVOSVCWFPgfnjdNoBYnN0lgvs6uwWVOaXdkIxC5AO0SYY4QhznffWyRyzFOEACS9NO2L-irj1rf2sM9zZispazejA60fR3nxkIOeHF7ov2aT725WNb-vNdmJyKUyzKYedoEerv8ArWFoOqaEhq51os457_VSRVu9u08ysrvfD72kM96XoTmgK2e4J0IQVUDezFdbw',
        accent: 'green',
      },
      {
        name: 'Marcus V.',
        role: 'スーシェフ',
        note: '厨房効率が高い',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCsmoNLSDD1pfMcoi0ZOcYvMZdgCK_w_NAGQqdIKnDlpAAY_tC6459INqmURkuS1nIuswntfufO273B2x04Qu-KeXI_UyL3jl8M9mzLszSlBuM7Z_BYCnldw3eyPrlIFupan0747upXhRK9GXKkZjCKDc4ygxbkWSYHk7ui7pAK9UQY0jytIpPqSHyL7yfTqCSrqhmXRmjDvo0CTKaBV_nSCRlm_CZ9F5D8aXcTKGninF9kXZYkMrWTt8PotaIrYUdYTExQNsMvGQ',
        accent: 'orange',
      },
      {
        name: 'Andre T.',
        role: 'フロアマネージャー',
        note: '連携力が高い',
        image:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBdSr_xdPa5UB4GdC4AmMGkCQva65g7oFz8jR-496WpGkB6bjoqK5o6L4kGH5C1EyK_lhw82zgFFFY8A6JLhyOim_feLrzWztvmDjcWVJ2XhVmsXr4QzOVjYLRzrg4o0HANFRPSoHVKsSKiEuN0p0tIvtQbY1D12uGCNCE8o7NPkZ_qg8MVlT9hyR5n0GRq9PsqzM2dimsRZWwfa67L-p5PQkxlKujegBFKue3RsGdh6NRJuWF72R_x3PuAx49jd4rQs9XZfEWxnw',
        accent: 'green',
      },
    ],
    days: ['月', '火', '水', '木', '金', '土', '日'],
  },
}

export function BentoFeatures() {
  const { copy, language } = useLanguage()
  const { ref, visible, revealClass, revealStyle } = useScrollReveal()
  const dashboard = copy.dashboard
  const showcase = getLocaleWithFallback(dashboardShowcaseCopy, language)

  return (
    <section id="dashboard" className="content-visibility-auto relative overflow-hidden py-20 lg:py-24">
      <div className="relative z-10 mx-auto w-full max-w-[88rem] px-4 md:px-6 lg:px-8 xl:px-10">
        <div ref={ref}>
          <div className={`${LANDING_SECTION_HEADER_MARGIN_CLASS} ${LANDING_SECTION_HEADER_CLASS} ${revealClass()}`} style={revealStyle(0)}>
            <span className={LANDING_EYEBROW_CLASS}>{dashboard.eyebrow}</span>
            <h2 className={LANDING_SECTION_TITLE_CLASS}>
              <span className="block">{dashboard.titleLine1}</span>
              <span className={LANDING_SECTION_ACCENT_CLASS}>{dashboard.titleLine2}</span>
            </h2>
            <p className={`${LANDING_BODY_CLASS} max-w-[44rem]`}>{dashboard.description}</p>
          </div>

          <div className={`space-y-5 lg:space-y-6 ${revealClass()}`} style={revealStyle(120)}>
            <div className="grid grid-cols-1 gap-4.5 md:grid-cols-3 lg:gap-5">
              {showcase.metrics.map((metric, index) => (
                <article
                  key={metric.label}
                  className={`${panelClass} flex min-h-[9.75rem] flex-col p-[1.35rem] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_1.35rem_2.8rem_rgba(68,34,11,0.08)] md:p-6 dark:hover:shadow-[0_1.5rem_3rem_rgba(0,0,0,0.4)] ${revealClass()}`}
                  style={revealStyle(180 + index * 70)}
                >
                  <p className={kpiLabelClass}>{metric.label}</p>
                  <div className="mt-2.5 flex min-h-[3rem] items-end gap-2.5">
                    <h3 className={`${kpiValueClass} ${numericClass} whitespace-nowrap`}>{metric.value}</h3>
                    {metric.delta ? (
                      <span className={`pb-1.5 text-[0.8125rem] font-bold text-emerald-600 ${numericClass}`}>{metric.delta}</span>
                    ) : null}
                    {metric.stars ? (
                      <div className="flex items-center gap-0.5 pb-1.5 text-[#b8612d]">
                        {Array.from({ length: metric.stars }).map((_, index) => (
                          <span
                            key={`${metric.label}-${index}`}
                            className="material-symbols-outlined text-[0.875rem]"
                            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'opsz' 24" }}
                          >
                            star
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className={`mt-auto pt-4 text-[0.8125rem] leading-[1.55] text-[#7a6658] dark:text-[#ccb59a] md:text-[0.875rem] ${numericClass}`}>{metric.note}</p>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,0.92fr)] lg:gap-5">
              <article className={`${panelClass} dashboard-chart-card flex h-full flex-col p-[1.35rem] md:p-6`}>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="font-serif text-[1.5rem] font-bold text-[#2c211b] dark:text-[#fff3e6] md:text-[1.65rem]">
                    {showcase.chartTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-[0.75rem] font-medium text-[#7a6759] dark:text-[#ccb59a]">
                    <LegendDot color="bg-[#a23f00]" label={showcase.legend.positive} />
                    <LegendDot color="bg-[#d8cec4]" label={showcase.legend.neutral} />
                    <LegendDot color="bg-[#d19580]" label={showcase.legend.negative} />
                  </div>
                </div>

                <div className={`${softInnerClass} dashboard-chart-shell relative flex min-h-[17rem] flex-1 flex-col overflow-hidden px-3.5 pb-4 pt-5 md:min-h-[18rem] md:px-5`}>
                  <div className="dashboard-chart-sheen pointer-events-none absolute inset-0" />
                  <div className="relative z-10 flex flex-1 items-end justify-between gap-2.5 md:gap-3.5">
                    {chartColumns.map((column, index) => (
                      <div
                        key={showcase.days[index]}
                        className="dashboard-chart-column flex h-full flex-1 flex-col items-center gap-3"
                        style={
                          { '--dashboard-delay': `${index * 180}ms` } as CSSProperties &
                            Record<'--dashboard-delay', string>
                        }
                      >
                        <div className="flex h-full w-full flex-col justify-end gap-1">
                          <div
                            className="dashboard-bar dashboard-bar-negative w-full rounded-t-[0.75rem] bg-[#d19580]/35 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{
                              height: `${column.negative}%`,
                              opacity: visible ? 1 : 0.3,
                              transform: visible ? 'scaleY(1)' : 'scaleY(0.2)',
                              transformOrigin: 'bottom',
                              transitionDelay: `${120 + index * 45}ms`,
                            }}
                          />
                          <div
                            className="dashboard-bar dashboard-bar-neutral w-full rounded-t-[0.75rem] bg-[#ece4db] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{
                              height: `${column.neutral}%`,
                              opacity: visible ? 1 : 0.3,
                              transform: visible ? 'scaleY(1)' : 'scaleY(0.2)',
                              transformOrigin: 'bottom',
                              transitionDelay: `${170 + index * 45}ms`,
                            }}
                          />
                          <div
                            className="dashboard-bar dashboard-bar-positive w-full rounded-t-[1rem] bg-[#f3871c] transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{
                              height: `${column.positive}%`,
                              opacity: visible ? 1 : 0.45,
                              transform: visible ? 'scaleY(1)' : 'scaleY(0.2)',
                              transformOrigin: 'bottom',
                              filter: visible ? 'saturate(1)' : 'saturate(0.92)',
                              transitionDelay: `${220 + index * 45}ms`,
                            }}
                          />
                        </div>
                        <span className={`${monoMetaClass} ${numericClass}`}>{showcase.days[index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <aside className={`${panelClass} p-[1.35rem] md:p-6`}>
                <h3 className="mb-5 font-serif text-[1.5rem] font-bold text-[#2c211b] dark:text-[#fff3e6] md:text-[1.65rem]">
                  {showcase.liveFeedTitle}
                </h3>
                <div className="space-y-3.5">
                  {showcase.feed.map((item, index) => (
                    <article
                      key={`${item.author}-${item.time}`}
                      className={`${softInnerClass} p-3.5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_1rem_2rem_rgba(68,34,11,0.06)] ${revealClass()}`}
                      style={revealStyle(260 + index * 90)}
                    >
                      <div className="mb-2.5 flex items-start justify-between gap-3">
                        <div className="flex origin-left scale-[0.82] text-[#b8612d]">
                          {Array.from({ length: item.rating }).map((_, index) => (
                            <span
                              key={`${item.author}-${index}`}
                              className="material-symbols-outlined text-[0.9375rem]"
                              style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'opsz' 24" }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                        <span className={`${monoMetaClass} ${numericClass}`}>{item.time}</span>
                      </div>
                      <p className="text-[0.875rem] italic leading-[1.65] text-[#675449] dark:text-[#dcc4a9] md:text-[0.9375rem]">
                        "{item.quote}"
                      </p>
                      <p className="mt-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#9a8577] dark:text-[#bda48a] md:text-[0.75rem]">
                        — {item.author}
                      </p>
                    </article>
                  ))}
                </div>
              </aside>
            </div>

            <article className={`${panelClass} p-[1.35rem] md:p-6`}>
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="font-serif text-[1.5rem] font-bold text-[#2c211b] dark:text-[#fff3e6] md:text-[1.65rem]">
                  {showcase.staffTitle}
                </h3>
                <button className="inline-flex items-center gap-1 text-[0.875rem] font-semibold text-[#b25a24] transition-colors hover:text-[#8f430f] dark:text-[#f0b37a] dark:hover:text-[#ffd0a0]">
                  {showcase.staffAction}
                  <span className="material-symbols-outlined text-[1rem]">arrow_forward</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4.5">
                {showcase.staff.map((member, index) => (
                  <div
                    key={member.name}
                    className={`${revealClass()} flex items-center gap-3.5 rounded-[0.95rem] bg-[#fcfaf7]/88 p-3.5 transition-[transform,background-color] duration-300 hover:-translate-y-1 hover:bg-white dark:bg-[#211812]/82 dark:hover:bg-[#281d16]`}
                    style={revealStyle(340 + index * 70)}
                  >
                    <div className="relative">
                      <img
                        src={member.image}
                        alt={member.name}
                        loading="lazy"
                        className="h-12 w-12 rounded-full object-cover grayscale"
                      />
                      <span
                        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-[#18120e] ${
                          member.accent === 'green' ? 'bg-emerald-500' : 'bg-orange-400'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-serif text-[0.98rem] font-bold leading-tight text-[#2c211b] dark:text-[#fff3e6]">
                        {member.name}
                      </h4>
                      <p className="mt-1 text-[0.8125rem] text-[#7a6658] dark:text-[#ccb59a]">{member.role}</p>
                      <p className="mt-1.5 text-[0.75rem] font-semibold text-[#b8612d] dark:text-[#f0b37a]">{member.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`dashboard-legend-dot h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  )
}
