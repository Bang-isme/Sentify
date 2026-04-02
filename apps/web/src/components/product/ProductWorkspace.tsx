import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type {
  ComplaintKeyword,
  CreateRestaurantInput,
  ImportRunSummary,
  InsightSummary,
  RestaurantDetail,
  RestaurantMembership,
  ReviewListResponse,
  ReviewsQuery,
  SentimentBreakdownRow,
  TrendPeriod,
  TrendPoint,
  UpdateRestaurantInput,
} from '../../lib/api'
import {
  FIELD_LIMITS,
  isGoogleMapsUrl,
  isValidDateRange,
  normalizeText,
  type FieldErrors,
} from '../../lib/validation'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { useLanguage } from '../../contexts/languageContext'

interface ProductWorkspaceProps {
  route: '/app' | '/app/reviews' | '/app/settings'
  isGuidedOnboardingFlow: boolean
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  selectedRestaurantId: string | null
  selectedRestaurantDetail: RestaurantDetail | null
  restaurantLoading: boolean
  restaurantError: string | null
  dashboard: {
    kpi: InsightSummary | null
    sentiment: SentimentBreakdownRow[]
    trend: TrendPoint[]
    complaints: ComplaintKeyword[]
  }
  dashboardLoading: boolean
  dashboardError: string | null
  trendPeriod: TrendPeriod
  onTrendPeriodChange: (period: TrendPeriod) => void
  importPending: boolean
  savePending: boolean
  createPending: boolean
  latestImportRun: ImportRunSummary | null
  importRuns: ImportRunSummary[]
  importRunsLoading: boolean
  importRunsError: string | null
  reviews: ReviewListResponse | null
  reviewsLoading: boolean
  reviewsError: string | null
  reviewFilters: ReviewsQuery
  onApplyReviewFilters: (filters: ReviewsQuery) => void
  onClearReviewFilters: () => void
  onReviewPageChange: (page: number) => void
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: '/app' | '/app/reviews' | '/app/settings') => void
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
  onImportReviews: () => Promise<void>
}

function formatNumber(
  value: number,
  language: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(language, options).format(value)
}

function formatPercentage(value: number, language: string) {
  return `${formatNumber(value, language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatRating(value: number, language: string) {
  return formatNumber(value, language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function formatReviewDate(value: string | null, language: string, fallback: string) {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: string | null, language: string, fallback: string) {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function parseCalendarDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatCalendarDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatCalendarDisplay(value: string | null | undefined, language: string, fallback: string) {
  const date = parseCalendarDate(value)

  if (!date) {
    return fallback
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addCalendarMonths(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1)
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function getCalendarWeekdayLabels(language: string) {
  const baseSunday = new Date(2024, 5, 2)

  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(language, { weekday: 'short' }).format(
      new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() + index),
    ),
  )
}

function getCalendarMonthLabels(language: string) {
  return Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(language, { month: 'short' }).format(new Date(2024, index, 1)),
  )
}

function getCalendarCells(month: Date) {
  const start = getMonthStart(month)
  const leadingDays = start.getDay()
  const gridStart = new Date(start.getFullYear(), start.getMonth(), 1 - leadingDays)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    )

    return {
      key: formatCalendarDate(date),
      date,
      isCurrentMonth: date.getMonth() === month.getMonth(),
    }
  })
}

function formatSourcePreview(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    const compactPath = url.pathname.length > 36 ? `${url.pathname.slice(0, 36)}...` : url.pathname
    return `${url.hostname}${compactPath}`
  } catch {
    return value.length > 56 ? `${value.slice(0, 56)}...` : value
  }
}

const ONBOARDING_HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB6afblcPed1y-hBIwh7VBvjJ0e3ojiRtvLsF-xQd8hhwaY90ct8Edytwtn6sNKQ7LQgnkjedZAUDLL894JkAGMmEVkEG8y5fIhKnFxibIXKwHPECZCAtLlt8V60_yjSSpC3A31lrg46V2T8EaGmvdAH1kn7bLRWu4suelNkUUDS2oFCzW1sv8ncuy_FhxIUqb6xaok9DyJkKP4rnBwuw5cDmTTJhZpaX1bCZHY-V7KWR8cpo3BxfxZGBeEJstkl6CiEZ_9WPPvug'

const ONBOARDING_STEP_ICONS = ['storefront', 'map', 'sync'] as const

function getOnboardingVisualCopy(language: string) {
  if (language.startsWith('vi')) {
    return {
      phaseLabel: 'Onboarding phase 01',
      cuisineLabel: 'Loại hình ẩm thực',
      cuisineOptions: ['Fine Dining', 'Bistro & Cafe', 'Ẩm thực bản địa', 'Fusion Cuisine'],
      googleMapsHint:
        '* Dùng để tự động cập nhật review và tín hiệu vận hành sát với thực tế hơn.',
      mapWaiting: 'Đang chờ xác nhận vị trí...',
      tipTitle: 'Mẹo nhỏ',
      tipBody:
        'Giữ đúng tên hiển thị và URL Google Maps sẽ giúp hệ thống đồng bộ ổn định hơn ở các lần nhập tiếp theo.',
      backLabel: 'Quay lại',
      nextStepLabel: 'Bước tiếp theo',
      trustedProvider: 'Verified Business Provider',
      previewModeLabel: 'Chế độ xem trước',
      previewSettingsHint:
        'Sau khi tạo nhà hàng, bạn sẽ thêm URL Google Maps tại đây để hệ thống có thể chạy lần nhập đầu tiên.',
      previewReviewsHint:
        'Sau lần nhập đầu tiên, các review gốc sẽ xuất hiện ở đây như bằng chứng cho quyết định vận hành tiếp theo.',
      previewReviews: [
        {
          author: 'Linh P.',
          timing: '2 ngày trước',
          excerpt: 'Món ăn đẹp và chỉn chu, nhưng nhịp phục vụ chậm lại rõ rệt sau 8 giờ tối.',
          rating: 4,
        },
        {
          author: 'Minh T.',
          timing: '5 ngày trước',
          excerpt: 'Không gian rất tốt, nhưng món thứ hai lên hơi chậm so với kỳ vọng.',
          rating: 3,
        },
      ],
    }
  }

  if (language.startsWith('ja')) {
    return {
      phaseLabel: 'Onboarding phase 01',
      cuisineLabel: '料理カテゴリー',
      cuisineOptions: ['Fine Dining', 'Bistro & Cafe', 'ローカル料理', 'Fusion Cuisine'],
      googleMapsHint:
        '* Google Maps のURLを正しく保つことで、レビュー同期と運営シグナルの再現性が高まります。',
      mapWaiting: '地図上の位置確認を待機中...',
      tipTitle: 'ヒント',
      tipBody:
        '表示名と Google Maps URL を揃えておくと、次回以降の取り込みがより安定します。',
      backLabel: '戻る',
      nextStepLabel: '次のステップ',
      trustedProvider: 'Verified Business Provider',
      previewModeLabel: 'プレビューモード',
      previewSettingsHint:
        '店舗作成後、この画面で Google Maps のURLを追加すると最初の取り込みを実行できるようになります。',
      previewReviewsHint:
        '最初の取り込み後、原文レビューがここに並び、次の運営判断の根拠として使われます。',
      previewReviews: [
        {
          author: 'Aiko S.',
          timing: '2日前',
          excerpt: '盛り付けは素晴らしかったですが、20時以降はサービスのテンポが落ちました。',
          rating: 4,
        },
        {
          author: 'Kenji M.',
          timing: '5日前',
          excerpt: '空間は良かったものの、2品目の提供が想定より少し遅く感じました。',
          rating: 3,
        },
      ],
    }
  }

  return {
    phaseLabel: 'Onboarding phase 01',
    cuisineLabel: 'Cuisine type',
    cuisineOptions: ['Fine Dining', 'Bistro & Cafe', 'Authentic Local', 'Fusion Cuisine'],
    googleMapsHint:
      '* Keep the Google Maps URL accurate so Sentify can pull fresher evidence on the next sync.',
    mapWaiting: 'Waiting for location confirmation...',
    tipTitle: 'Small tip',
    tipBody:
      'Matching the restaurant display name and Google Maps URL keeps imports more stable over time.',
    backLabel: 'Back',
    nextStepLabel: 'Next step',
    trustedProvider: 'Verified Business Provider',
    previewModeLabel: 'Preview mode',
    previewSettingsHint:
      'After the restaurant is created, this is where the Google Maps URL is added so the first import can run.',
    previewReviewsHint:
      'After the first import, original reviews appear here as evidence for the next operating decision.',
    previewReviews: [
      {
        author: 'Linh P.',
        timing: '2 days ago',
        excerpt: 'Beautiful plating and strong flavors, but service pacing slowed down after 8pm.',
        rating: 4,
      },
      {
        author: 'Minh T.',
        timing: '5 days ago',
        excerpt: 'Loved the ambience, though the second course arrived slower than expected.',
        rating: 3,
      },
    ],
  }
}

function getOnboardingPreviewIndex({
  hasRestaurant,
  hasSource,
}: {
  hasRestaurant: boolean
  hasSource: boolean
}) {
  if (!hasRestaurant) {
    return 0
  }

  if (!hasSource) {
    return 1
  }

  return 2
}

function getOnboardingStepState(
  index: number,
  activeStepIndex: number,
): 'active' | 'done' | 'pending' {
  if (index === activeStepIndex) {
    return 'active'
  }

  if (index < activeStepIndex) {
    return 'done'
  }

  return 'pending'
}

function canAccessOnboardingStep(
  index: number,
  {
    hasRestaurant,
    hasSource,
  }: {
    hasRestaurant: boolean
    hasSource: boolean
  },
) {
  if (index === 0) {
    return true
  }

  if (index === 1) {
    return hasRestaurant
  }

  return hasSource
}

function getReviewToneClasses(sentiment: SentimentBreakdownRow['label'] | null, rating: number) {
  if (sentiment === 'NEGATIVE' || rating <= 2) {
    return {
      badge: 'border-amber-300/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200',
      rail: 'before:bg-amber-400/75',
    }
  }

  if (sentiment === 'POSITIVE' || rating >= 4) {
    return {
      badge: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200',
      rail: 'before:bg-emerald-400/75',
    }
  }

  return {
    badge: 'border-border-light/70 bg-bg-light/70 text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white',
    rail: 'before:bg-primary/70',
  }
}

function PageIntro({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  meta?: Array<{
    icon: string
    label: string
    tone?: 'default' | 'success' | 'warning'
  }>
  actions?: ReactNode
}) {
  const toneClass = (tone: 'default' | 'success' | 'warning' = 'default') =>
    tone === 'success'
      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200'
        : 'border-border-light/70 bg-bg-light/70 text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white'

  return (
    <section className="rounded-[1.8rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              <span className="size-2 rounded-full bg-primary"></span>
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={`text-[1.9rem] font-black tracking-tight text-text-charcoal dark:text-white ${
              eyebrow ? 'mt-4' : ''
            }`}
          >
            {title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
            {description}
          </p>
          {meta?.length ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {meta.map((item) => (
                <div
                  key={`${item.icon}-${item.label}`}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClass(item.tone)}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end [&>*]:w-full [&>*]:justify-center sm:[&>*]:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SectionCard({
  title,
  description,
  headerAside,
  tone = 'default',
  className,
  children,
}: {
  title: string
  description?: string
  headerAside?: ReactNode
  tone?: 'default' | 'accent'
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`rounded-[1.75rem] border p-5 shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6 ${
        tone === 'accent'
          ? 'border-primary/18 bg-primary/[0.04] dark:border-primary/15 dark:bg-primary/[0.05]'
          : 'border-border-light/70 bg-surface-white/88 dark:border-border-dark/70 dark:bg-surface-dark/82'
      } ${className ?? ''}`}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-charcoal dark:text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
              {description}
            </p>
          ) : null}
        </div>
        {headerAside ? <div className="w-full shrink-0 sm:w-auto">{headerAside}</div> : null}
      </div>
      {children}
    </section>
  )
}

function NativeFieldShell({
  icon,
  children,
  open = false,
}: {
  icon: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <div
      className={`group relative flex h-11 items-center rounded-2xl border bg-surface-white transition dark:bg-surface-dark ${
        open
          ? 'border-primary shadow-[0_0_0_3px_rgba(212,175,55,0.12)]'
          : 'border-border-light focus-within:border-primary dark:border-border-dark'
      }`}
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 flex size-5 items-center justify-center text-text-silver-light transition-colors group-focus-within:text-primary dark:text-text-silver-dark"
      >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
    </div>
  )
}

function RatingFilterSelect({
  copy,
  value,
  onChange,
}: {
  copy: ProductUiCopy['app']
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const options = [
    { value: '', label: copy.allRatings },
    { value: '5', label: '5 ★' },
    { value: '4', label: '4 ★' },
    { value: '3', label: '3 ★' },
    { value: '2', label: '2 ★' },
    { value: '1', label: '1 ★' },
  ]
  const selectedOption = options.find((option) => option.value === (value ?? '')) ?? options[0]

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={rootRef}>
      <NativeFieldShell icon={isOpen ? 'expand_less' : 'expand_more'} open={isOpen}>
        <button
          id="review-filter-rating"
          type="button"
          aria-label={copy.filterRating}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="flex h-full w-full items-center px-4 pr-11 text-left text-sm font-semibold text-text-charcoal outline-none dark:text-white"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{selectedOption.label}</span>
        </button>
      </NativeFieldShell>

      <div
        className={`absolute left-0 top-[calc(100%+0.55rem)] z-30 w-full overflow-hidden rounded-[1.2rem] border border-border-light/80 bg-surface-white/96 p-1 shadow-[0_20px_50px_-22px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all dark:border-border-dark/80 dark:bg-surface-dark/96 ${
          isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
        role="listbox"
        aria-label={copy.filterRating}
        aria-hidden={!isOpen}
      >
        {options.map((option) => {
          const isActive = option.value === (value ?? '')

          return (
            <button
              key={option.value || 'all'}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                isActive
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-text-charcoal hover:bg-primary/6 dark:text-white dark:hover:bg-white/5'
              }`}
              onClick={() => {
                onChange(option.value || undefined)
                setIsOpen(false)
              }}
            >
              <span>{option.label}</span>
              {isActive ? (
                <span className="material-symbols-outlined text-[18px]">check</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DateFilterField({
  label,
  value,
  language,
  previousMonthLabel,
  nextMonthLabel,
  onChange,
}: {
  label: string
  value: string | undefined
  language: string
  previousMonthLabel: string
  nextMonthLabel: string
  onChange: (value: string | undefined) => void
}) {
  const [view, setView] = useState<'day' | 'month' | 'year'>('day')
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getMonthStart(parseCalendarDate(value) ?? new Date()),
  )
  const [yearPageStart, setYearPageStart] = useState(() => {
    const initialYear = (parseCalendarDate(value) ?? new Date()).getFullYear()
    return initialYear - 5
  })
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedDate = parseCalendarDate(value)
  const today = new Date()
  const weekdayLabels = getCalendarWeekdayLabels(language)
  const monthLabels = getCalendarMonthLabels(language)
  const calendarCells = getCalendarCells(visibleMonth)
  const visibleYear = visibleMonth.getFullYear()
  const monthLabel = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth)
  const yearRangeLabel = `${yearPageStart} - ${yearPageStart + 11}`
  const yearOptions = Array.from({ length: 12 }, (_, index) => yearPageStart + index)
  const calendarViewKey = `${view}-${visibleYear}-${visibleMonth.getMonth()}-${yearPageStart}`

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={rootRef}>
      <NativeFieldShell icon="calendar_month" open={isOpen}>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`flex h-full w-full items-center px-4 pr-11 text-left text-sm font-semibold outline-none ${
            value ? 'text-text-charcoal dark:text-white' : 'text-text-silver-light dark:text-text-silver-dark'
          }`}
          onClick={() => {
            const baseDate = selectedDate ?? new Date()
            setVisibleMonth(getMonthStart(baseDate))
            setYearPageStart(baseDate.getFullYear() - 5)
            setView('day')
            setIsOpen((current) => !current)
          }}
        >
          <span>{formatCalendarDisplay(value, language, 'mm/dd/yyyy')}</span>
        </button>
      </NativeFieldShell>

      <div
        className={`absolute left-0 top-[calc(100%+0.55rem)] z-30 w-[18rem] max-w-[calc(100vw-2rem)] rounded-[1.35rem] border border-border-light/80 bg-surface-white/96 p-3 shadow-[0_20px_50px_-22px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all dark:border-border-dark/80 dark:bg-surface-dark/96 ${
          isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
        role="dialog"
        aria-label={label}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={
              view === 'day'
                ? previousMonthLabel
                : view === 'month'
                  ? previousMonthLabel
                  : `${previousMonthLabel} ${yearRangeLabel}`
            }
            className="flex size-9 items-center justify-center rounded-full border border-border-light/70 bg-bg-light/70 text-text-charcoal transition hover:border-primary/35 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white"
            onClick={() => {
              if (view === 'day') {
                setVisibleMonth((current) => addCalendarMonths(current, -1))
                return
              }

              if (view === 'month') {
                setVisibleMonth((current) => new Date(current.getFullYear() - 1, current.getMonth(), 1))
                return
              }

              setYearPageStart((current) => current - 12)
            }}
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            className="inline-flex min-w-[8.5rem] items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-text-charcoal transition hover:bg-primary/8 hover:text-primary dark:text-white dark:hover:bg-primary/10"
            onClick={() => {
              if (view === 'day') {
                setView('month')
                return
              }

              if (view === 'month') {
                setYearPageStart(visibleYear - 5)
                setView('year')
                return
              }

              setView('month')
            }}
          >
            <span>{view === 'year' ? yearRangeLabel : view === 'month' ? String(visibleYear) : monthLabel}</span>
            <span className="material-symbols-outlined text-[16px]">
              {view === 'day' ? 'expand_more' : 'unfold_more'}
            </span>
          </button>
          <button
            type="button"
            aria-label={
              view === 'day'
                ? nextMonthLabel
                : view === 'month'
                  ? nextMonthLabel
                  : `${nextMonthLabel} ${yearRangeLabel}`
            }
            className="flex size-9 items-center justify-center rounded-full border border-border-light/70 bg-bg-light/70 text-text-charcoal transition hover:border-primary/35 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white"
            onClick={() => {
              if (view === 'day') {
                setVisibleMonth((current) => addCalendarMonths(current, 1))
                return
              }

              if (view === 'month') {
                setVisibleMonth((current) => new Date(current.getFullYear() + 1, current.getMonth(), 1))
                return
              }

              setYearPageStart((current) => current + 12)
            }}
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        <div key={calendarViewKey} className="app-calendar-panel-enter mt-4">
          {view === 'day' ? (
            <div className="grid grid-cols-7 gap-1">
              {weekdayLabels.map((weekday) => (
                <div
                  key={weekday}
                  className="pb-1 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark"
                >
                  {weekday}
                </div>
              ))}

              {calendarCells.map((cell) => {
                const isSelected = selectedDate ? isSameCalendarDay(cell.date, selectedDate) : false
                const isToday = isSameCalendarDay(cell.date, today)

                return (
                  <button
                    key={cell.key}
                    type="button"
                    aria-label={new Intl.DateTimeFormat(language, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(cell.date)}
                    className={`flex h-9 items-center justify-center rounded-xl text-sm transition ${
                      isSelected
                        ? 'bg-primary text-white dark:text-bg-dark'
                        : cell.isCurrentMonth
                          ? 'text-text-charcoal hover:bg-primary/8 hover:text-primary dark:text-white dark:hover:bg-primary/12'
                          : 'text-text-silver-light hover:bg-primary/6 hover:text-primary dark:text-text-silver-dark dark:hover:bg-primary/10'
                    } ${isToday && !isSelected ? 'border border-primary/35' : 'border border-transparent'}`}
                    onClick={() => {
                      onChange(formatCalendarDate(cell.date))
                      setVisibleMonth(getMonthStart(cell.date))
                      setIsOpen(false)
                      setView('day')
                    }}
                  >
                    {cell.date.getDate()}
                  </button>
                )
              })}
            </div>
          ) : view === 'month' ? (
            <div className="grid grid-cols-3 gap-2">
              {monthLabels.map((item, index) => {
                const isActive =
                  selectedDate &&
                  selectedDate.getFullYear() === visibleYear &&
                  selectedDate.getMonth() === index

                return (
                  <button
                    key={`${visibleYear}-${item}`}
                    type="button"
                    className={`flex h-11 items-center justify-center rounded-2xl px-3 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-primary text-white dark:text-bg-dark'
                        : 'border border-border-light/70 bg-bg-light/70 text-text-charcoal hover:border-primary/35 hover:bg-primary/8 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white dark:hover:bg-primary/12'
                    }`}
                    onClick={() => {
                      setVisibleMonth(new Date(visibleYear, index, 1))
                      setView('day')
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {yearOptions.map((year) => {
                const isActive = selectedDate ? selectedDate.getFullYear() === year : visibleYear === year

                return (
                  <button
                    key={year}
                    type="button"
                    className={`flex h-11 items-center justify-center rounded-2xl px-3 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-primary text-white dark:text-bg-dark'
                        : 'border border-border-light/70 bg-bg-light/70 text-text-charcoal hover:border-primary/35 hover:bg-primary/8 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white dark:hover:bg-primary/12'
                    }`}
                    onClick={() => {
                      setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))
                      setView('month')
                    }}
                  >
                    {year}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'primary'
}) {
  return (
    <div
      className={`min-h-[9.5rem] rounded-[1.4rem] border p-5 ${
        tone === 'primary'
          ? 'border-primary/25 bg-primary/8'
          : 'border-border-light/70 bg-bg-light/75 dark:border-border-dark dark:bg-bg-dark/55'
      }`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-text-charcoal dark:text-white">
        {value}
      </div>
    </div>
  )
}

function SidebarStatusPill({
  icon,
  label,
  tone = 'neutral',
}: {
  icon: string
  label: string
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200'
        : 'border-border-light/70 bg-surface-white/80 text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white'

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm ${toneClass}`}>
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <span className="font-semibold leading-5">{label}</span>
    </div>
  )
}

function StatusMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'error'
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200'
          : 'border-border-light/70 bg-surface-white/80 text-text-silver-light dark:border-border-dark dark:bg-surface-dark/70 dark:text-text-silver-dark'
      }`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <span className="text-xs font-medium text-red-600 dark:text-red-300">{message}</span>
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border-light/90 bg-bg-light/70 p-6 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/60 dark:text-text-silver-dark">
      {message}
    </div>
  )
}

function getImportRunMerchantSummary(copy: ProductUiCopy['app'], run: ImportRunSummary): string {
  if (run.status === 'FAILED') {
    return copy.syncStatusFailed
  }

  if (run.status === 'RUNNING') {
    return copy.syncStatusRunning
  }

  if (run.status === 'QUEUED') {
    return copy.syncStatusQueued
  }

  return run.imported > 0 ? copy.syncStatusCompletedWithChanges : copy.syncStatusCompletedNoChanges
}

function ImportStatusSummary({
  copy,
  latestRun,
  loading,
  error,
  language,
  onOpenSettings,
}: {
  copy: ProductUiCopy['app']
  latestRun: ImportRunSummary | null
  loading: boolean
  error: string | null
  language: string
  onOpenSettings: () => void
}) {
  const timingValue =
    latestRun?.completedAt ??
    latestRun?.failedAt ??
    latestRun?.updatedAt ??
    latestRun?.createdAt ??
    null

  const toneClass =
    latestRun?.status === 'FAILED'
      ? 'border-red-300/35 bg-red-500/8 dark:border-red-400/20 dark:bg-red-500/10'
      : latestRun?.status === 'RUNNING' || latestRun?.status === 'QUEUED'
        ? 'border-amber-300/35 bg-amber-500/8 dark:border-amber-400/20 dark:bg-amber-500/10'
        : 'border-border-light/70 bg-surface-white/88 dark:border-border-dark/70 dark:bg-surface-dark/82'

  return (
    <SectionCard title={copy.syncStatusTitle} description={copy.syncStatusDescription} tone="accent">
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading && !latestRun ? <StatusMessage>{copy.loadingImportHistory}</StatusMessage> : null}

      {!loading && !latestRun ? <EmptyPanel message={copy.syncStatusEmpty} /> : null}

      {latestRun ? (
        <div className={`rounded-[1.4rem] border p-5 ${toneClass}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
                    latestRun.status === 'COMPLETED'
                      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
                      : latestRun.status === 'FAILED'
                        ? 'border-red-300/35 bg-red-500/10 text-red-700 dark:border-red-400/25 dark:bg-red-500/12 dark:text-red-200'
                        : 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200'
                  }`}
                >
                  {copy.importRunStatusLabels[latestRun.status]}
                </span>
                <span className="text-xs text-text-silver-light dark:text-text-silver-dark">
                  {copy.syncStatusLastSync}:{' '}
                  {formatDateTime(timingValue, language, copy.importHistoryUnavailable)}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold leading-7 text-text-charcoal dark:text-white">
                {getImportRunMerchantSummary(copy, latestRun)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(140px,1fr)_auto] lg:min-w-[300px]">
              <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                  {copy.syncStatusNewReviews}
                </div>
                <div className="mt-1 text-2xl font-black text-text-charcoal dark:text-white">
                  {formatNumber(latestRun.imported, language)}
                </div>
              </div>
              {latestRun.status === 'FAILED' ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-primary/35 bg-primary/8 px-5 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/12"
                  onClick={onOpenSettings}
                >
                  {copy.dashboardSecondaryCta}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}

function SettingsSourceSummary({
  copy,
  detail,
  latestRun,
  language,
}: {
  copy: ProductUiCopy['app']
  detail: { googleMapUrl: string | null | undefined }
  latestRun: ImportRunSummary | null
  language: string
}) {
  const sourcePreview = formatSourcePreview(detail.googleMapUrl)
  const timingValue =
    latestRun?.completedAt ??
    latestRun?.failedAt ??
    latestRun?.updatedAt ??
    latestRun?.createdAt ??
    null

  return (
    <section className="rounded-[1.55rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            {copy.settingsSourceTitle}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {detail.googleMapUrl ? copy.sourceReady : copy.sourceMissing}
          </p>
          {sourcePreview ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
              <span className="material-symbols-outlined text-[15px] text-primary">link</span>
              <span className="truncate">{sourcePreview}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
          <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {copy.syncStatusLastSync}
            </div>
            <div className="mt-1 text-sm font-semibold text-text-charcoal dark:text-white">
              {formatDateTime(timingValue, language, copy.importHistoryUnavailable)}
            </div>
          </div>
          <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {copy.syncStatusNewReviews}
            </div>
            <div className="mt-1 text-sm font-semibold text-text-charcoal dark:text-white">
              {latestRun ? formatNumber(latestRun.imported, language) : copy.importHistoryUnavailable}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ImportRunHistoryPanel({
  copy,
  latestRun,
  runs,
  loading,
  error,
  language,
}: {
  copy: ProductUiCopy['app']
  latestRun: ImportRunSummary | null
  runs: ImportRunSummary[]
  loading: boolean
  error: string | null
  language: string
}) {
  const history = runs.length > 0 ? runs : latestRun ? [latestRun] : []
  const activeRun =
    latestRun && (latestRun.status === 'QUEUED' || latestRun.status === 'RUNNING') ? latestRun : null
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const forceExpanded = Boolean(activeRun || latestRun?.status === 'FAILED')
  const isExpanded = forceExpanded || detailsExpanded

  const statusToneClass = (status: ImportRunSummary['status']) =>
    status === 'COMPLETED'
      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
      : status === 'FAILED'
        ? 'border-red-300/35 bg-red-500/10 text-red-700 dark:border-red-400/25 dark:bg-red-500/12 dark:text-red-200'
        : 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200'

  return (
    <SectionCard
      title={copy.importHistoryTitle}
      description={copy.importHistoryDescription}
      tone={activeRun ? 'accent' : 'default'}
      headerAside={
        <div className="flex flex-wrap items-center gap-2">
          {activeRun ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>{copy.importHistoryActive}</span>
            </div>
          ) : null}
          <button
            type="button"
            aria-expanded={isExpanded}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white"
            onClick={() => setDetailsExpanded((current) => !current)}
          >
            <span>{isExpanded ? copy.importHistoryToggleClose : copy.importHistoryToggleOpen}</span>
            <span
              aria-hidden="true"
              className={`material-symbols-outlined text-[18px] transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            >
              expand_more
            </span>
          </button>
        </div>
      }
    >
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading && history.length === 0 ? <StatusMessage>{copy.loadingImportHistory}</StatusMessage> : null}

      {!loading && history.length === 0 ? <EmptyPanel message={copy.importHistoryEmpty} /> : null}

      {latestRun ? (
        <div className="rounded-[1.3rem] border border-border-light/70 bg-bg-light/65 p-4 dark:border-border-dark dark:bg-bg-dark/55">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${statusToneClass(latestRun.status)}`}
                >
                  {copy.importRunStatusLabels[latestRun.status]}
                </span>
                <span className="text-xs text-text-silver-light dark:text-text-silver-dark">
                  {copy.syncStatusLastSync}:{' '}
                  {formatDateTime(
                    latestRun.completedAt ??
                      latestRun.failedAt ??
                      latestRun.updatedAt ??
                      latestRun.createdAt,
                    language,
                    copy.importHistoryUnavailable,
                  )}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-text-charcoal dark:text-white">
                {getImportRunMerchantSummary(copy, latestRun)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[126px] rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                  {copy.syncStatusNewReviews}
                </div>
                <div className="mt-1 text-xl font-black text-text-charcoal dark:text-white">
                  {formatNumber(latestRun.imported, language)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isExpanded && history.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {history.map((run, index) => {
            const isLatest = latestRun?.id === run.id && index === 0
            const phaseLabel =
              (run.phase && copy.importRunPhaseLabels[run.phase as keyof typeof copy.importRunPhaseLabels]) ||
              run.phase ||
              copy.importRunPhaseLabels.QUEUED
            const timingValue =
              run.completedAt ??
              run.failedAt ??
              run.updatedAt ??
              run.createdAt

            return (
              <article
                key={run.id}
                className="rounded-[1.3rem] border border-border-light/70 bg-bg-light/65 p-4 dark:border-border-dark dark:bg-bg-dark/55"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${statusToneClass(run.status)}`}
                  >
                    {copy.importRunStatusLabels[run.status]}
                  </span>
                  {isLatest ? (
                    <span className="inline-flex items-center rounded-full border border-border-light/70 bg-surface-white/80 px-3 py-1 text-[11px] font-semibold text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white">
                      {copy.importHistoryLatestBadge}
                    </span>
                  ) : null}
                  <span className="text-xs text-text-silver-light dark:text-text-silver-dark">
                    {copy.importHistoryUpdatedAt}:{' '}
                    {formatDateTime(timingValue, language, copy.importHistoryUnavailable)}
                  </span>
                </div>

                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]">
                  <div>
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {phaseLabel}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {getImportRunMerchantSummary(copy, run)}
                    </p>
                    {run.status === 'FAILED' && run.errorMessage ? (
                      <p className="mt-2 text-sm leading-6 text-red-600 dark:text-red-300">
                        {run.errorMessage}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-silver-light dark:text-text-silver-dark">
                      <span>
                        {copy.importHistoryStartedAt}:{' '}
                        {formatDateTime(run.startedAt ?? run.createdAt, language, copy.importHistoryUnavailable)}
                      </span>
                      {run.completedAt ? (
                        <span>
                          {copy.importHistoryCompletedAt}:{' '}
                          {formatDateTime(run.completedAt, language, copy.importHistoryUnavailable)}
                        </span>
                      ) : null}
                      {run.failedAt ? (
                        <span>
                          {copy.importHistoryFailedAt}:{' '}
                          {formatDateTime(run.failedAt, language, copy.importHistoryUnavailable)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                        {copy.importHistoryImported}
                      </div>
                      <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
                        {formatNumber(run.imported, language)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                        {copy.importHistorySkipped}
                      </div>
                      <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
                        {formatNumber(run.skipped, language)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                        {copy.importHistoryCollected}
                      </div>
                      <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
                        {formatNumber(run.scrape.collectedReviewCount ?? run.total, language)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                        {copy.importHistoryCoverage}
                      </div>
                      <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
                        {run.scrape.coveragePercentage === null
                          ? copy.importHistoryUnavailable
                          : formatPercentage(run.scrape.coveragePercentage, language)}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </SectionCard>
  )
}

function RestaurantSetupForm({
  copy,
  pending,
  actionLabel,
  title,
  description,
  initialValues,
  tone = 'default',
  actionTone = 'primary',
  embed = false,
  variant = 'default',
  onSecondaryAction,
  onSubmit,
}: {
  copy: ProductUiCopy['app']
  pending: boolean
  actionLabel: string
  title: string
  description: string
  initialValues?: {
    name?: string | null
    address?: string | null
    googleMapUrl?: string | null
  }
  tone?: 'default' | 'accent'
  actionTone?: 'primary' | 'secondary'
  embed?: boolean
  variant?: 'default' | 'onboarding'
  onSecondaryAction?: () => void
  onSubmit: (input: CreateRestaurantInput) => Promise<void>
}) {
  const { language } = useLanguage()
  const initialName = initialValues?.name ?? ''
  const initialAddress = initialValues?.address ?? ''
  const initialGoogleMapUrl = initialValues?.googleMapUrl ?? ''
  const isEditing = initialValues != null
  const showsSourceField = variant !== 'onboarding'
  const [name, setName] = useState(initialName)
  const [address, setAddress] = useState(initialAddress)
  const [googleMapUrl, setGoogleMapUrl] = useState(initialGoogleMapUrl)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    setName(initialName)
    setAddress(initialAddress)
    setGoogleMapUrl(initialGoogleMapUrl)
    setFieldErrors({})
  }, [initialAddress, initialGoogleMapUrl, initialName])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = normalizeText(name)
    const trimmedAddress = normalizeText(address)
    const trimmedGoogleMapUrl = normalizeText(googleMapUrl)
    const nextErrors: FieldErrors = {}

    if (!trimmedName) {
      nextErrors.name = copy.validation.restaurantNameRequired
    } else if (trimmedName.length > FIELD_LIMITS.restaurantName) {
      nextErrors.name = copy.validation.restaurantNameTooLong
    }

    if (trimmedAddress.length > FIELD_LIMITS.restaurantAddress) {
      nextErrors.address = copy.validation.restaurantAddressTooLong
    }

    if (showsSourceField && trimmedGoogleMapUrl) {
      const sourceValidation = isGoogleMapsUrl(trimmedGoogleMapUrl)

      if (!sourceValidation.valid) {
        nextErrors.googleMapUrl =
          sourceValidation.reason === 'not_google'
            ? copy.validation.googleMapsUrlMustBeGoogle
            : copy.validation.googleMapsUrlInvalid
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    const nextInput: CreateRestaurantInput = {
      name: trimmedName,
      address: trimmedAddress || undefined,
    }

    if (showsSourceField) {
      nextInput.googleMapUrl = trimmedGoogleMapUrl || undefined
    }

    await onSubmit(nextInput)

    if (!isEditing) {
      setFieldErrors({})
      setName('')
      setAddress('')
      setGoogleMapUrl('')
    }
  }

  const visualCopy = getOnboardingVisualCopy(language)
  const baseInputClass =
    'h-13 w-full rounded-[1.05rem] border border-[#e5d8ca] bg-[rgba(252,247,239,0.92)] px-4 text-[0.95rem] text-[#22170f] shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] outline-none transition placeholder:text-[#b09883] focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(235,122,28,0.12)] focus:ring-0'
  const iconInputClass = `${baseInputClass} pl-14`

  if (variant === 'onboarding') {
    return (
      <section className="overflow-hidden rounded-[1.7rem] border border-[#e7dccd] bg-[linear-gradient(180deg,#fffdfa_0%,#fbf4ea_100%)] shadow-[0_34px_90px_-56px_rgba(17,11,8,0.72)] backdrop-blur-sm">
        <div className="border-b border-[#f0e4d7] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="font-serif text-[1.65rem] font-semibold tracking-[-0.04em] text-[#2a1c12] sm:text-[1.8rem]">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-[0.9rem] leading-7 text-[#7d6652]">{description}</p>
            </div>
            <span className="hidden size-11 items-center justify-center rounded-[0.95rem] border border-[#efd8be] bg-[linear-gradient(180deg,#fff6eb_0%,#fff0dc_100%)] text-primary shadow-[0_18px_32px_-24px_rgba(235,122,28,0.6)] sm:flex">
              <span className="material-symbols-outlined text-[22px]">restaurant</span>
            </span>
          </div>
        </div>

        <form className="space-y-5 px-5 py-5 sm:px-6 sm:py-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4">
            <label
              htmlFor="setup-restaurant-name"
              className="grid gap-2 text-[0.92rem] font-semibold text-[#2b1c12]"
            >
              <span>{copy.restaurantNameLabel}</span>
              <input
                id="setup-restaurant-name"
                required
                aria-label={copy.restaurantNameLabel}
                maxLength={FIELD_LIMITS.restaurantName}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setFieldErrors((current) => ({ ...current, name: undefined }))
                }}
                aria-invalid={fieldErrors.name ? 'true' : 'false'}
                className={baseInputClass}
                type="text"
                placeholder="Ví dụ: Le Jardin Secret"
              />
              <FieldError message={fieldErrors.name} />
            </label>
          </div>

          <label
            htmlFor="setup-restaurant-address"
            className="grid gap-2 text-[0.92rem] font-semibold text-[#2b1c12]"
          >
            <span>{copy.restaurantAddressLabel}</span>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#9b7a5f]">
                location_on
              </span>
              <input
                id="setup-restaurant-address"
                aria-label={copy.restaurantAddressLabel}
                maxLength={FIELD_LIMITS.restaurantAddress}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value)
                  setFieldErrors((current) => ({ ...current, address: undefined }))
                }}
                aria-invalid={fieldErrors.address ? 'true' : 'false'}
                className={iconInputClass}
                type="text"
                placeholder="Số nhà, tên đường, quận, thành phố..."
              />
            </div>
            <FieldError message={fieldErrors.address} />
          </label>

          <div className="flex flex-col gap-4 border-t border-[#f0e4d7] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f5a47] transition hover:text-[#2a1c12]"
              onClick={() => {
                onSecondaryAction?.()
              }}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                arrow_back
              </span>
              <span>{visualCopy.backLabel}</span>
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-bold text-white shadow-[0_18px_36px_-18px_rgba(235,122,28,0.88)] transition hover:-translate-y-0.5 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto dark:text-bg-dark"
            >
              <span>{pending ? `${actionLabel}...` : actionLabel}</span>
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                chevron_right
              </span>
            </button>
          </div>
        </form>
      </section>
    )
  }

  const formContent = (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
        <label
          htmlFor="setup-restaurant-name"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.restaurantNameLabel}</span>
          <input
            id="setup-restaurant-name"
            required
            maxLength={FIELD_LIMITS.restaurantName}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setFieldErrors((current) => ({ ...current, name: undefined }))
            }}
            aria-invalid={fieldErrors.name ? 'true' : 'false'}
            className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            type="text"
          />
          <FieldError message={fieldErrors.name} />
        </label>
        <label
          htmlFor="setup-restaurant-address"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.restaurantAddressLabel}</span>
          <input
            id="setup-restaurant-address"
            maxLength={FIELD_LIMITS.restaurantAddress}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setFieldErrors((current) => ({ ...current, address: undefined }))
            }}
            aria-invalid={fieldErrors.address ? 'true' : 'false'}
            className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            type="text"
          />
          <FieldError message={fieldErrors.address} />
        </label>
        <label
          htmlFor="setup-restaurant-source"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white md:col-span-2"
        >
          <span>{copy.googleMapsUrlLabel}</span>
          <input
            id="setup-restaurant-source"
            value={googleMapUrl}
            onChange={(event) => {
              setGoogleMapUrl(event.target.value)
              setFieldErrors((current) => ({ ...current, googleMapUrl: undefined }))
            }}
            aria-invalid={fieldErrors.googleMapUrl ? 'true' : 'false'}
            className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            type="url"
            placeholder={copy.googleMapsUrlPlaceholder}
          />
          <FieldError message={fieldErrors.googleMapUrl} />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className={`inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
              actionTone === 'secondary'
                ? 'border border-primary/30 bg-transparent text-primary hover:border-primary hover:bg-primary/8'
                : 'bg-primary text-white hover:bg-primary-dark dark:text-bg-dark'
            }`}
          >
            {pending ? `${actionLabel}...` : actionLabel}
          </button>
        </div>
      </form>
  )

  if (embed) {
    return formContent
  }

  return (
    <SectionCard title={title} description={description} tone={tone}>
      {formContent}
    </SectionCard>
  )
}

function RestaurantSwitcher({
  copy,
  restaurants,
  currentRestaurant,
  onSelectRestaurant,
  showLabel = true,
  compact = false,
}: {
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  currentRestaurant: RestaurantMembership | null
  onSelectRestaurant: (restaurantId: string) => void
  showLabel?: boolean
  compact?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!currentRestaurant) {
    return null
  }

  if (restaurants.length <= 1) {
    return (
      <div>
        {showLabel ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherLabel}
            </div>
            <div className="mt-3 text-base font-bold text-text-charcoal dark:text-white">
              {currentRestaurant.name}
            </div>
          </>
        ) : null}
        <div className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherReadonly}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {showLabel ? (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherLabel}
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-[1.35rem] border border-border-light/80 bg-bg-light/75 px-4 text-left transition hover:border-primary/35 hover:bg-primary/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-border-dark dark:bg-bg-dark/55 ${
          compact ? 'py-3.5' : 'py-4'
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div>
          <div className="text-base font-bold text-text-charcoal dark:text-white">
            {currentRestaurant.name}
          </div>
          {!compact ? (
            <div className="mt-1 text-sm text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherHint}
            </div>
          ) : null}
        </div>
        <span
          className={`material-symbols-outlined text-base text-text-silver-light transition-transform duration-200 dark:text-text-silver-dark ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      <div
        className={`grid overflow-hidden rounded-[1.3rem] border border-border-light/80 bg-surface-white/96 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark dark:bg-surface-dark/96 ${
          isOpen
            ? 'mt-3 max-h-80 p-2 opacity-100'
            : 'pointer-events-none mt-0 max-h-0 p-0 opacity-0'
        }`}
        role="listbox"
        aria-label={copy.restaurantSwitcherLabel}
      >
        {restaurants.map((restaurant) => {
          const isActive = restaurant.id === currentRestaurant.id

          return (
            <button
              key={restaurant.id}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-charcoal hover:bg-primary/6 dark:text-white dark:hover:bg-white/5'
              }`}
              onClick={() => {
                onSelectRestaurant(restaurant.id)
                setIsOpen(false)
              }}
            >
              <span className="font-semibold">{restaurant.name}</span>
              {isActive ? <span className="material-symbols-outlined text-base">check</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OnboardingPanel({
  copy,
  restaurant,
  detail,
  createPending,
  savePending,
  importPending,
  latestImportRun,
  importRunsLoading,
  importRunsError,
  onBack,
  onCreateRestaurant,
  onSaveRestaurant,
  onImportReviews,
}: {
  copy: ProductUiCopy['app']
  restaurant: RestaurantMembership | null
  detail: RestaurantDetail | null
  createPending: boolean
  savePending: boolean
  importPending: boolean
  latestImportRun: ImportRunSummary | null
  importRunsLoading: boolean
  importRunsError: string | null
  onBack: () => void
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
  onImportReviews: () => Promise<void>
}) {
  const { language } = useLanguage()
  const visualCopy = getOnboardingVisualCopy(language)
  const hasRestaurant = Boolean(restaurant)
  const hasSource = Boolean(detail?.googleMapUrl ?? restaurant?.googleMapUrl)
  const [stepOverride, setStepOverride] = useState<number | null>(null)
  const derivedStepIndex = getOnboardingPreviewIndex({ hasRestaurant, hasSource })
  const activeStepIndex = stepOverride ?? derivedStepIndex
  const restaurantSetupInitialValues = restaurant
    ? {
        name: detail?.name ?? restaurant.name,
        address: detail?.address,
        googleMapUrl: detail?.googleMapUrl ?? restaurant.googleMapUrl,
      }
    : undefined
  const previewTitle =
    activeStepIndex === 1
      ? copy.settingsSourceTitle
      : activeStepIndex === 2
        ? copy.onboardingSteps[2] ?? copy.dashboardPrimaryCta
        : copy.onboardingTitle
  const previewDescription =
    activeStepIndex === 1
      ? copy.settingsSourceDescription
      : activeStepIndex === 2
        ? copy.syncStatusDescription
        : copy.onboardingDescription

  useEffect(() => {
    setStepOverride((current) => {
      if (current == null) {
        return current
      }

      return current > derivedStepIndex ? derivedStepIndex : current
    })
  }, [derivedStepIndex])

  function openOnboardingStep(index: number) {
    if (!canAccessOnboardingStep(index, { hasRestaurant, hasSource })) {
      return
    }

    setStepOverride(index === derivedStepIndex ? null : index)
  }

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0">
        <img
          alt="Restaurant onboarding ambiance"
          className="h-full w-full object-cover object-[34%_35%]"
          src={ONBOARDING_HERO_IMAGE}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,7,5,0.58)_0%,rgba(10,7,5,0.42)_24%,rgba(10,7,5,0.52)_54%,rgba(10,7,5,0.86)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,231,205,0.16),transparent_24%),linear-gradient(90deg,rgba(8,5,4,0.34)_0%,rgba(8,5,4,0.12)_18%,rgba(8,5,4,0.12)_82%,rgba(8,5,4,0.42)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[16%] bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.02)_46%,rgba(255,255,255,0)_100%)] mix-blend-screen blur-sm" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1320px] flex-col items-center px-4 pb-10 pt-28 sm:px-6 sm:pb-12 sm:pt-32 lg:px-10 lg:pb-14 lg:pt-36">
        <div className="w-full max-w-[720px] text-center text-white">
          <div className="font-serif text-[1.85rem] font-semibold italic tracking-[-0.03em] text-white/94 sm:text-[2.2rem]">
            Sentify
          </div>
          <h1 className="mt-5 font-serif text-[2.45rem] font-semibold tracking-[-0.06em] text-white sm:text-[3.35rem] lg:text-[4.6rem] lg:leading-[0.93]">
            {previewTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-[38rem] text-[0.98rem] leading-7 text-white/80 sm:text-[1.04rem]">
            {previewDescription}
          </p>
        </div>

        <div className="mt-12 hidden w-full max-w-[700px] lg:block">
          <div className="relative flex items-start justify-between gap-4">
            {copy.onboardingSteps.map((step, index) => (
              <article
                key={`${step}-desktop-immersive`}
                className="relative z-10 flex w-full flex-col items-center gap-3"
              >
                {index < copy.onboardingSteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[calc(50%+1.55rem)] right-[calc(-50%+1.55rem)] top-5 h-px ${
                      index < activeStepIndex ? 'bg-primary/75' : 'bg-white/24'
                    }`}
                  />
                ) : null}
                <button
                  type="button"
                  disabled={!canAccessOnboardingStep(index, { hasRestaurant, hasSource })}
                  aria-current={index === activeStepIndex ? 'step' : undefined}
                  className={`group flex flex-col items-center gap-3 transition ${
                    canAccessOnboardingStep(index, { hasRestaurant, hasSource })
                      ? 'cursor-pointer hover:-translate-y-0.5'
                      : 'cursor-default'
                  }`}
                  onClick={() => openOnboardingStep(index)}
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-full border shadow-[0_12px_24px_-18px_rgba(0,0,0,0.55)] backdrop-blur ${
                      getOnboardingStepState(index, activeStepIndex) === 'active'
                        ? 'border-primary/24 bg-primary text-white'
                        : getOnboardingStepState(index, activeStepIndex) === 'done'
                          ? 'border-[#f3d1ae]/34 bg-[#fff4e8] text-primary'
                          : 'border-white/24 bg-white/10 text-white/58'
                    }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                      {ONBOARDING_STEP_ICONS[index] ?? 'radio_button_checked'}
                    </span>
                  </span>
                  <p
                    className={`max-w-[12rem] text-center text-[0.8rem] font-semibold leading-6 ${
                      getOnboardingStepState(index, activeStepIndex) === 'pending'
                        ? 'text-white/56'
                        : 'text-white/86'
                    }`}
                  >
                    {step}
                  </p>
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 grid w-full gap-4 lg:hidden">
          {copy.onboardingSteps.map((step, index) => (
            <button
              key={`${step}-mobile`}
              type="button"
              disabled={!canAccessOnboardingStep(index, { hasRestaurant, hasSource })}
              aria-current={index === activeStepIndex ? 'step' : undefined}
              className={`flex items-center gap-4 rounded-[1.35rem] border border-white/14 bg-[rgba(20,14,10,0.54)] px-4 py-4 text-left text-white shadow-[0_20px_40px_-36px_rgba(0,0,0,0.45)] backdrop-blur-md transition ${
                canAccessOnboardingStep(index, { hasRestaurant, hasSource })
                  ? 'cursor-pointer hover:-translate-y-0.5'
                  : 'cursor-default'
              }`}
              onClick={() => openOnboardingStep(index)}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${
                  getOnboardingStepState(index, activeStepIndex) === 'active'
                    ? 'border-primary/24 bg-primary text-white'
                    : getOnboardingStepState(index, activeStepIndex) === 'done'
                      ? 'border-[#f3d1ae]/34 bg-[#fff4e8] text-primary'
                      : 'border-white/24 bg-white/10 text-white/58'
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  {ONBOARDING_STEP_ICONS[index] ?? 'radio_button_checked'}
                </span>
              </span>
              <p
                className={`text-sm font-semibold ${
                  getOnboardingStepState(index, activeStepIndex) === 'pending'
                    ? 'text-white/56'
                    : 'text-white/88'
                }`}
              >
                {step}
              </p>
            </button>
          ))}
        </div>

        {activeStepIndex === 0 ? (
          <div className="mt-10 w-full max-w-[680px]">
            <RestaurantSetupForm
              copy={copy}
              pending={restaurant ? savePending : createPending}
              actionLabel={restaurant ? copy.saveChanges : visualCopy.nextStepLabel}
              title={copy.setupTitle}
              description={copy.setupDescription}
              initialValues={restaurantSetupInitialValues}
              variant="onboarding"
              onSecondaryAction={() => {
                if (restaurant) {
                  setStepOverride(null)
                  return
                }

                onBack()
              }}
              onSubmit={async (input) => {
                if (restaurant) {
                  const updateInput: UpdateRestaurantInput = {
                    name: input.name,
                    address: input.address ?? null,
                  }

                  if (input.googleMapUrl !== undefined) {
                    updateInput.googleMapUrl = input.googleMapUrl ?? null
                  }

                  await onSaveRestaurant(updateInput)
                  setStepOverride(null)
                  return
                }

                setStepOverride(null)
                await onCreateRestaurant(input)
              }}
            />
          </div>
        ) : (
          <div className="mt-10 w-full max-w-[1040px]">
            {activeStepIndex === 1 ? (
              <OnboardingSourceSetupPanel
                copy={copy}
                visualCopy={visualCopy}
                sourceValue={detail?.googleMapUrl ?? restaurant?.googleMapUrl ?? ''}
                pending={savePending}
                onBack={() => setStepOverride(0)}
                onSaveRestaurant={async (input) => {
                  await onSaveRestaurant(input)
                  setStepOverride(null)
                }}
              />
            ) : (
              <OnboardingImportStep
                copy={copy}
                visualCopy={visualCopy}
                restaurant={restaurant}
                detail={detail}
                importPending={importPending}
                latestImportRun={latestImportRun}
                importRunsLoading={importRunsLoading}
                importRunsError={importRunsError}
                language={language}
                onBack={() => setStepOverride(1)}
                onEditSource={() => setStepOverride(1)}
                onImportReviews={onImportReviews}
              />
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-5 px-4 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/56">
          <span>{visualCopy.trustedProvider}</span>
          <span className="h-4 w-px bg-white/18" />
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          <span className="material-symbols-outlined text-[18px]">lock</span>
          <span className="material-symbols-outlined text-[18px]">cloud_done</span>
        </div>
      </div>
    </section>
  )
}

function OnboardingSourceSetupPanel({
  copy,
  visualCopy,
  sourceValue,
  pending,
  onBack,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  visualCopy: ReturnType<typeof getOnboardingVisualCopy>
  sourceValue: string
  pending: boolean
  onBack: () => void
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [googleMapUrl, setGoogleMapUrl] = useState(sourceValue)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    setGoogleMapUrl(sourceValue)
  }, [sourceValue])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedGoogleMapUrl = normalizeText(googleMapUrl)

    if (!trimmedGoogleMapUrl) {
      setFieldErrors({ googleMapUrl: copy.validation.googleMapsUrlInvalid })
      return
    }

    const sourceValidation = isGoogleMapsUrl(trimmedGoogleMapUrl)

    if (!sourceValidation.valid) {
      setFieldErrors({
        googleMapUrl:
          sourceValidation.reason === 'not_google'
            ? copy.validation.googleMapsUrlMustBeGoogle
            : copy.validation.googleMapsUrlInvalid,
      })
      return
    }

    setFieldErrors({})
    await onSaveRestaurant({
      googleMapUrl: trimmedGoogleMapUrl,
    })
  }

  return (
    <SectionCard
      title={copy.settingsSourceTitle}
      description={copy.settingsSourceDescription}
      tone="accent"
      className="bg-[rgba(255,251,245,0.92)] dark:bg-[rgba(28,18,13,0.78)]"
      headerAside={
        <span className="inline-flex items-center rounded-full border border-primary/18 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          {visualCopy.previewModeLabel}
        </span>
      }
    >
      <form className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]" onSubmit={handleSubmit}>
        <div className="rounded-[1.45rem] border border-border-light/70 bg-surface-white/86 p-5 dark:border-border-dark dark:bg-surface-dark/72">
          <label
            htmlFor="onboarding-source-url"
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{copy.googleMapsUrlLabel}</span>
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-primary">
                link
              </span>
              <input
                id="onboarding-source-url"
                name="googleMapUrl"
                value={googleMapUrl}
                onChange={(event) => {
                  setGoogleMapUrl(event.target.value)
                  setFieldErrors((current) => ({ ...current, googleMapUrl: undefined }))
                }}
                aria-label={copy.googleMapsUrlLabel}
                aria-invalid={fieldErrors.googleMapUrl ? 'true' : 'false'}
                className="h-12 w-full rounded-2xl border border-border-light bg-surface-white px-4 pl-12 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                type="url"
                placeholder={copy.googleMapsUrlPlaceholder}
              />
            </div>
            <FieldError message={fieldErrors.googleMapUrl} />
          </label>
          <p className="mt-3 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {visualCopy.previewSettingsHint}
          </p>
          <div className="mt-4 flex flex-col gap-3 border-t border-border-light/70 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-border-dark">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-semibold text-text-silver-light transition hover:text-text-charcoal dark:text-text-silver-dark dark:hover:text-white"
              onClick={onBack}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                arrow_back
              </span>
              <span>{visualCopy.backLabel}</span>
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
            >
              {pending ? copy.saving : copy.saveChanges}
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          <SidebarStatusPill icon="warning" label={copy.sourceMissing} tone="warning" />
          <SidebarStatusPill icon="tune" label={copy.importBlocked} tone="warning" />
          <div className="rounded-[1.35rem] border border-dashed border-border-light/80 bg-bg-light/60 p-4 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/45 dark:text-text-silver-dark">
            {visualCopy.googleMapsHint}
          </div>
        </div>
      </form>
    </SectionCard>
  )
}

function OnboardingImportStep({
  copy,
  visualCopy,
  restaurant,
  detail,
  importPending,
  latestImportRun,
  importRunsLoading,
  importRunsError,
  language,
  onBack,
  onEditSource,
  onImportReviews,
}: {
  copy: ProductUiCopy['app']
  visualCopy: ReturnType<typeof getOnboardingVisualCopy>
  restaurant: RestaurantMembership | null
  detail: RestaurantDetail | null
  importPending: boolean
  latestImportRun: ImportRunSummary | null
  importRunsLoading: boolean
  importRunsError: string | null
  language: string
  onBack: () => void
  onEditSource: () => void
  onImportReviews: () => Promise<void>
}) {
  const restaurantName = detail?.name ?? restaurant?.name ?? copy.anonymousGuest
  const googleMapUrl = detail?.googleMapUrl ?? restaurant?.googleMapUrl ?? null
  const hasSource = Boolean(googleMapUrl)
  const isSyncInFlight =
    importPending || latestImportRun?.status === 'QUEUED' || latestImportRun?.status === 'RUNNING'

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <SectionCard
        title={copy.syncStatusTitle}
        description={copy.syncStatusDescription}
        tone="accent"
        className="bg-[rgba(255,251,245,0.92)] dark:bg-[rgba(28,18,13,0.78)]"
        headerAside={
          <span className="inline-flex items-center rounded-full border border-primary/18 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {visualCopy.previewModeLabel}
          </span>
        }
      >
        <div className="grid gap-3">
          <SidebarStatusPill icon="storefront" label={restaurantName} />
          <SidebarStatusPill icon="task_alt" label={copy.sourceReady} tone="success" />
          <SidebarStatusPill
            icon={isSyncInFlight ? 'sync' : 'check_circle'}
            label={isSyncInFlight ? copy.syncStatusRunning : copy.importReady}
            tone={isSyncInFlight ? 'neutral' : 'success'}
          />
          <StatusMessage>{latestImportRun ? getImportRunMerchantSummary(copy, latestImportRun) : visualCopy.previewReviewsHint}</StatusMessage>
          <button
            type="button"
            disabled={!hasSource || isSyncInFlight}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
            onClick={() => {
              void onImportReviews()
            }}
          >
            {isSyncInFlight ? copy.importing : copy.dashboardPrimaryCta}
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary/24 bg-white/72 px-5 text-sm font-semibold text-primary transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/8 dark:border-primary/20 dark:bg-white/5"
            onClick={onBack}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            <span>{visualCopy.backLabel}</span>
          </button>
        </div>
      </SectionCard>

      <ImportStatusSummary
        copy={copy}
        latestRun={latestImportRun}
        loading={importRunsLoading}
        error={importRunsError}
        language={language}
        onOpenSettings={onEditSource}
      />
    </div>
  )
}

function DashboardPanel({
  copy,
  detail,
  dashboard,
  loading,
  error,
  trendPeriod,
  importPending,
  latestImportRun,
  importRunsLoading,
  importRunsError,
  language,
  onTrendPeriodChange,
  onImportReviews,
  onNavigate,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail | null
  dashboard: ProductWorkspaceProps['dashboard']
  loading: boolean
  error: string | null
  trendPeriod: TrendPeriod
  importPending: boolean
  latestImportRun: ImportRunSummary | null
  importRunsLoading: boolean
  importRunsError: string | null
  language: string
  onTrendPeriodChange: (period: TrendPeriod) => void
  onImportReviews: () => Promise<void>
  onNavigate: (route: '/app' | '/app/reviews' | '/app/settings') => void
}) {
  const kpi = dashboard.kpi ?? detail?.insightSummary ?? null
  const hasSource = Boolean(detail?.googleMapUrl)
  const totalReviews = kpi?.totalReviews ?? 0
  const hasImportedReviews = totalReviews > 0

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={copy.navDashboard}
        title={copy.dashboardTitle}
        description={copy.dashboardDescription}
        meta={[
          {
            icon: 'storefront',
            label: detail?.name ?? copy.anonymousGuest,
          },
          {
            icon: hasSource ? 'task_alt' : 'warning',
            label: hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration,
            tone: hasSource ? 'success' : 'warning',
          },
          {
            icon: 'rate_review',
            label: `${formatNumber(totalReviews, language)} ${copy.navReviews}`,
          },
        ]}
        actions={
          hasSource ? (
            <>
              <button
                type="button"
                disabled={importPending}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
                onClick={() => {
                  void onImportReviews()
                }}
              >
                {importPending ? copy.importing : copy.dashboardPrimaryCta}
              </button>
              <button
                type="button"
                className="group inline-flex h-11 items-center justify-center gap-2 px-1 text-sm font-semibold text-text-silver-light transition-colors hover:text-primary dark:text-text-silver-dark dark:hover:text-primary"
                onClick={() => onNavigate('/app/settings')}
              >
                <span>{copy.dashboardSecondaryCta}</span>
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1"
                >
                  arrow_forward
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark dark:text-bg-dark"
              onClick={() => onNavigate('/app/settings')}
            >
              {copy.dashboardSecondaryCta}
            </button>
          )
        }
      />

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading ? <StatusMessage>{copy.loadingDashboard}</StatusMessage> : null}

      <ImportStatusSummary
        copy={copy}
        latestRun={latestImportRun}
        loading={importRunsLoading}
        error={importRunsError}
        language={language}
        onOpenSettings={() => onNavigate('/app/settings')}
      />

      {!hasImportedReviews ? (
        <SectionCard
          title={copy.dashboardPrimaryCta}
          description={copy.noReviews}
          tone="accent"
          headerAside={
            <div className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
              {hasSource ? copy.importReady : copy.importBlocked}
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <SidebarStatusPill icon="leaderboard" label={copy.sentimentSplit} />
            <SidebarStatusPill icon="priority_high" label={copy.complaintKeywords} />
            <SidebarStatusPill icon="timeline" label={copy.ratingTrend} />
          </div>
        </SectionCard>
      ) : null}

      <div
        className={`grid items-start gap-4 lg:grid-cols-2 ${
          hasSource ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
        }`}
      >
        <MetricCard label={copy.totalReviews} value={formatNumber(totalReviews, language)} />
        <MetricCard label={copy.averageRating} value={formatRating(kpi?.averageRating ?? 0, language)} />
        <MetricCard
          label={copy.negativeShare}
          value={formatPercentage(kpi?.negativePercentage ?? 0, language)}
          tone={(kpi?.negativePercentage ?? 0) >= 50 ? 'primary' : 'default'}
        />
        {!hasSource ? (
          <SectionCard title={copy.sourceReadiness} tone="accent">
            <div className="grid gap-3 text-sm">
              <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
                {copy.sourceMissing}
              </div>
              <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
                {copy.importBlocked}
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title={copy.sentimentSplit}>
          {dashboard.sentiment.length === 0 ? (
            <EmptyPanel message={copy.noReviews} />
          ) : (
            <div className="grid gap-3">
              {dashboard.sentiment.map((row) => (
                <div key={row.label} className="rounded-[1.2rem] border border-border-light/70 p-4 dark:border-border-dark">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {copy.sentimentLabels[row.label]}
                    </div>
                    <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                      {formatNumber(row.count, language)} | {formatPercentage(row.percentage, language)}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-border-light dark:bg-border-dark">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(row.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={copy.complaintKeywords}>
          {dashboard.complaints.length === 0 ? (
            <EmptyPanel message={copy.noComplaints} />
          ) : (
            <div className="grid gap-3">
              {dashboard.complaints.slice(0, 6).map((keyword) => (
                <div
                  key={keyword.keyword}
                  className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-border-light/70 px-4 py-4 dark:border-border-dark"
                >
                  <div>
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {keyword.keyword}
                    </div>
                    <div className="mt-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                      {formatPercentage(keyword.percentage, language)}
                    </div>
                  </div>
                  <div className="text-lg font-black text-primary">
                    {formatNumber(keyword.count, language)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={copy.ratingTrend}>
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              trendPeriod === 'week'
                ? 'bg-primary text-white dark:text-bg-dark'
                : 'border border-border-light text-text-charcoal hover:border-primary/60 hover:text-primary dark:border-border-dark dark:text-white'
            }`}
            onClick={() => onTrendPeriodChange('week')}
          >
            {copy.periodWeek}
          </button>
          <button
            type="button"
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              trendPeriod === 'month'
                ? 'bg-primary text-white dark:text-bg-dark'
                : 'border border-border-light text-text-charcoal hover:border-primary/60 hover:text-primary dark:border-border-dark dark:text-white'
            }`}
            onClick={() => onTrendPeriodChange('month')}
          >
            {copy.periodMonth}
          </button>
        </div>

        {dashboard.trend.length === 0 ? (
          <EmptyPanel message={copy.noTrend} />
        ) : (
          <div className="grid gap-3">
            {dashboard.trend.map((point) => (
              <div
                key={point.label}
                className="grid gap-3 rounded-[1.2rem] border border-border-light/70 p-4 dark:border-border-dark md:grid-cols-[110px_minmax(0,1fr)_112px]"
              >
                <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                  {point.label}
                </div>
                <div className="self-center">
                  <div className="h-2 rounded-full bg-border-light dark:bg-border-dark">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min((point.averageRating / 5) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                  {formatRating(point.averageRating, language)} | {formatNumber(point.reviewCount, language)}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function ReviewsPanel({
  copy,
  detail,
  reviews,
  loading,
  error,
  reviewFilters,
  language,
  onApplyReviewFilters,
  onClearReviewFilters,
  onReviewPageChange,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail | null
  reviews: ReviewListResponse | null
  loading: boolean
  error: string | null
  reviewFilters: ReviewsQuery
  language: string
  onApplyReviewFilters: (filters: ReviewsQuery) => void
  onClearReviewFilters: () => void
  onReviewPageChange: (page: number) => void
}) {
  const [draftFilters, setDraftFilters] = useState<ReviewsQuery>(reviewFilters)
  const [filterError, setFilterError] = useState<string | null>(null)

  useEffect(() => {
    setDraftFilters(reviewFilters)
  }, [reviewFilters])

  const currentPage = reviews?.pagination.page ?? reviewFilters.page ?? 1
  const totalPages = reviews?.pagination.totalPages ?? 0
  const activeFilterCount = [reviewFilters.rating, reviewFilters.from, reviewFilters.to].filter(Boolean).length
  const totalReviewItems = reviews?.pagination.total ?? 0
  const appliedFilterPills = [
    reviewFilters.rating
      ? `${copy.filterRating}: ${reviewFilters.rating}`
      : null,
    reviewFilters.from
      ? `${copy.filterFrom}: ${formatCalendarDisplay(reviewFilters.from, language, reviewFilters.from)}`
      : null,
    reviewFilters.to
      ? `${copy.filterTo}: ${formatCalendarDisplay(reviewFilters.to, language, reviewFilters.to)}`
      : null,
  ].filter(Boolean) as string[]

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={copy.navReviews}
        title={copy.reviewsTitle}
        description={copy.reviewsDescription}
        meta={[
          {
            icon: 'storefront',
            label: detail?.name ?? copy.anonymousGuest,
          },
          {
            icon: activeFilterCount > 0 ? 'filter_alt' : 'filter_alt_off',
            label:
              activeFilterCount > 0
                ? `${formatNumber(activeFilterCount, language)} ${copy.reviewFilters}`
                : copy.allRatings,
          },
          {
            icon: 'description',
            label: `${formatNumber(totalReviewItems, language)} ${copy.paginationItems}`,
          },
        ]}
      />

      <SectionCard
        title={copy.reviewFilters}
        className="relative z-20 overflow-visible"
        headerAside={
          activeFilterCount > 0 ? (
            <button
              type="button"
              className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-silver-light transition hover:border-primary/35 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-text-silver-dark"
              onClick={() => {
                setFilterError(null)
                setDraftFilters({
                  page: 1,
                  limit: 10,
                })
                onClearReviewFilters()
              }}
            >
              {copy.clearFilters}
            </button>
          ) : (
            <div className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-silver-light dark:border-border-dark dark:bg-bg-dark/55 dark:text-text-silver-dark">
              {copy.allRatings}
            </div>
          )
        }
      >
        {filterError ? <StatusMessage tone="error">{filterError}</StatusMessage> : null}
        {appliedFilterPills.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {appliedFilterPills.map((pill) => (
              <div
                key={pill}
                className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                {pill}
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{copy.filterRating}</span>
            <RatingFilterSelect
              copy={copy}
              value={draftFilters.rating}
              onChange={(nextRating) =>
                setDraftFilters((current) => ({
                  ...current,
                  rating: nextRating,
                }))
              }
            />
          </div>
          <div className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{copy.filterFrom}</span>
            <DateFilterField
              label={copy.filterFrom}
              value={draftFilters.from}
              language={language}
              previousMonthLabel={copy.datePickerPreviousMonth}
              nextMonthLabel={copy.datePickerNextMonth}
              onChange={(nextDate) => {
                setFilterError(null)
                setDraftFilters((current) => ({
                  ...current,
                  from: nextDate,
                }))
              }}
            />
          </div>
          <div className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{copy.filterTo}</span>
            <DateFilterField
              label={copy.filterTo}
              value={draftFilters.to}
              language={language}
              previousMonthLabel={copy.datePickerPreviousMonth}
              nextMonthLabel={copy.datePickerNextMonth}
              onChange={(nextDate) => {
                setFilterError(null)
                setDraftFilters((current) => ({
                  ...current,
                  to: nextDate,
                }))
              }}
            />
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-1 xl:justify-end">
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark sm:flex-none dark:text-bg-dark"
              onClick={() => {
                if (!isValidDateRange(draftFilters.from, draftFilters.to)) {
                  setFilterError(copy.validation.filterDateRangeInvalid)
                  return
                }

                setFilterError(null)
                onApplyReviewFilters({
                  ...draftFilters,
                  page: 1,
                  limit: 10,
                })
              }}
            >
              {copy.applyFilters}
            </button>
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary sm:flex-none dark:border-border-dark dark:text-white"
              onClick={() => {
                setFilterError(null)
                setDraftFilters({
                  page: 1,
                  limit: 10,
                })
                onClearReviewFilters()
              }}
            >
              {copy.clearFilters}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={copy.reviewEvidence}
        headerAside={
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
            <span>{formatNumber(totalReviewItems, language)} {copy.paginationItems}</span>
            <span className="text-primary/60">|</span>
            <span>{currentPage}/{Math.max(totalPages, 1)}</span>
          </div>
        }
      >
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

        {loading ? (
          <StatusMessage>{copy.loadingReviews}</StatusMessage>
        ) : reviews?.data.length ? (
          <div className="grid gap-4">
            {reviews.data.map((review) => (
              <article
                key={review.id}
                className={`relative rounded-[1.2rem] border border-border-light/70 bg-bg-light/75 p-4 pl-5 before:absolute before:bottom-4 before:left-0 before:top-4 before:w-1 before:rounded-full dark:border-border-dark dark:bg-bg-dark/55 ${getReviewToneClasses(review.sentiment, review.rating).rail}`}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                        {review.authorName || copy.anonymousGuest}
                      </div>
                      <div className="text-xs text-text-silver-light dark:text-text-silver-dark">
                        {formatReviewDate(review.reviewDate, language, copy.noSourceDate)}
                      </div>
                    </div>
                    <p
                      className="mt-2 max-w-3xl text-sm leading-6 text-text-charcoal dark:text-text-silver-dark"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {review.content || copy.noReviewContent}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-bold sm:justify-self-end ${getReviewToneClasses(review.sentiment, review.rating).badge}`}
                  >
                    <span>{formatRating(review.rating, language)}</span>
                    {review.sentiment ? (
                      <>
                        <span>|</span>
                        <span>{copy.sentimentLabels[review.sentiment]}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}

            <div className="flex flex-col gap-4 border-t border-border-light pt-4 dark:border-border-dark sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                {formatNumber(reviews.pagination.total, language)} {copy.paginationItems}
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  className="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-full border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:text-white"
                  onClick={() => onReviewPageChange(currentPage - 1)}
                >
                  {copy.paginationPrevious}
                </button>
                <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                  {currentPage}/{Math.max(totalPages, 1)}
                </div>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-full border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:text-white"
                  onClick={() => onReviewPageChange(currentPage + 1)}
                >
                  {copy.paginationNext}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyPanel message={copy.noReviews} />
        )}
      </SectionCard>
    </div>
  )
}

function RestaurantProfileForm({
  copy,
  detail,
  pending,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail
  pending: boolean
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [name, setName] = useState(detail.name)
  const [address, setAddress] = useState(detail.address ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = normalizeText(name)
    const trimmedAddress = normalizeText(address)
    const nextErrors: FieldErrors = {}

    if (!trimmedName) {
      nextErrors.name = copy.validation.restaurantNameRequired
    } else if (trimmedName.length > FIELD_LIMITS.restaurantName) {
      nextErrors.name = copy.validation.restaurantNameTooLong
    }

    if (trimmedAddress.length > FIELD_LIMITS.restaurantAddress) {
      nextErrors.address = copy.validation.restaurantAddressTooLong
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    await onSaveRestaurant({
      name: trimmedName,
      address: trimmedAddress || null,
    })
  }

  return (
    <SectionCard title={copy.settingsRestaurantTitle} description={copy.settingsRestaurantDescription}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label
          htmlFor="settings-restaurant-name"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.restaurantNameLabel}</span>
          <input
            id="settings-restaurant-name"
            required
            maxLength={FIELD_LIMITS.restaurantName}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setFieldErrors((current) => ({ ...current, name: undefined }))
            }}
            aria-invalid={fieldErrors.name ? 'true' : 'false'}
            className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            type="text"
          />
          <FieldError message={fieldErrors.name} />
        </label>
        <label
          htmlFor="settings-restaurant-address"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.restaurantAddressLabel}</span>
          <input
            id="settings-restaurant-address"
            maxLength={FIELD_LIMITS.restaurantAddress}
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setFieldErrors((current) => ({ ...current, address: undefined }))
            }}
            aria-invalid={fieldErrors.address ? 'true' : 'false'}
            className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            type="text"
          />
          <FieldError message={fieldErrors.address} />
        </label>
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
          >
            {pending ? copy.saving : copy.saveChanges}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

function SourceSettingsForm({
  copy,
  detail,
  pending,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail
  pending: boolean
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [googleMapUrl, setGoogleMapUrl] = useState(detail.googleMapUrl ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedGoogleMapUrl = normalizeText(googleMapUrl)

    if (trimmedGoogleMapUrl) {
      const sourceValidation = isGoogleMapsUrl(trimmedGoogleMapUrl)

      if (!sourceValidation.valid) {
        setFieldErrors({
          googleMapUrl:
            sourceValidation.reason === 'not_google'
              ? copy.validation.googleMapsUrlMustBeGoogle
              : copy.validation.googleMapsUrlInvalid,
        })
        return
      }
    }

    setFieldErrors({})
    await onSaveRestaurant({
      googleMapUrl: trimmedGoogleMapUrl || null,
    })
  }

  return (
    <SectionCard
      title={copy.settingsSourceTitle}
      description={copy.settingsSourceDescription}
      tone="accent"
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label
          htmlFor="settings-restaurant-source"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.googleMapsUrlLabel}</span>
          <input
            id="settings-restaurant-source"
            value={googleMapUrl}
            onChange={(event) => {
              setGoogleMapUrl(event.target.value)
              setFieldErrors((current) => ({ ...current, googleMapUrl: undefined }))
            }}
            aria-invalid={fieldErrors.googleMapUrl ? 'true' : 'false'}
            className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            type="url"
            placeholder={copy.googleMapsUrlPlaceholder}
          />
          <FieldError message={fieldErrors.googleMapUrl} />
        </label>
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
          >
            {pending ? copy.saving : copy.saveChanges}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

function SettingsPanel({
  copy,
  detail,
  pending,
  createPending,
  latestImportRun,
  importRuns,
  importRunsLoading,
  importRunsError,
  language,
  onCreateRestaurant,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail | null
  pending: boolean
  createPending: boolean
  latestImportRun: ImportRunSummary | null
  importRuns: ImportRunSummary[]
  importRunsLoading: boolean
  importRunsError: string | null
  language: string
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [isAddRestaurantOpen, setIsAddRestaurantOpen] = useState(false)

  if (!detail) {
    return (
      <div className="grid gap-6">
        <PageIntro title={copy.settingsTitle} description={copy.settingsDescription} />
        <EmptyPanel message={copy.noRestaurants} />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={copy.navSettings}
        title={copy.settingsTitle}
        description={copy.settingsDescription}
        meta={[
          {
            icon: 'storefront',
            label: detail.name,
          },
          {
            icon: detail.googleMapUrl ? 'task_alt' : 'warning',
            label: detail.googleMapUrl ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration,
            tone: detail.googleMapUrl ? 'success' : 'warning',
          },
          {
            icon: 'pin_drop',
            label: detail.address || copy.restaurantAddressLabel,
          },
        ]}
      />

      <SettingsSourceSummary
        copy={copy}
        detail={detail}
        latestRun={latestImportRun}
        language={language}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RestaurantProfileForm
          key={`${detail.id}-profile-${detail.name}-${detail.address ?? ''}`}
          copy={copy}
          detail={detail}
          pending={pending}
          onSaveRestaurant={onSaveRestaurant}
        />
        <SourceSettingsForm
          key={`${detail.id}-source-${detail.googleMapUrl ?? ''}`}
          copy={copy}
          detail={detail}
          pending={pending}
          onSaveRestaurant={onSaveRestaurant}
        />
      </div>

      <ImportRunHistoryPanel
        copy={copy}
        latestRun={latestImportRun}
        runs={importRuns}
        loading={importRunsLoading}
        error={importRunsError}
        language={language}
      />

      <SectionCard
        title={copy.addRestaurantTitle}
        description={copy.addRestaurantDescription}
        headerAside={
          <button
            type="button"
            aria-expanded={isAddRestaurantOpen}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white"
            onClick={() => setIsAddRestaurantOpen((current) => !current)}
          >
            <span>{copy.createAnotherRestaurant}</span>
            <span
              aria-hidden="true"
              className={`material-symbols-outlined text-[18px] transition-transform ${
                isAddRestaurantOpen ? 'rotate-180' : ''
              }`}
            >
              expand_more
            </span>
          </button>
        }
      >
        {isAddRestaurantOpen ? (
          <RestaurantSetupForm
            copy={copy}
            pending={createPending}
            actionLabel={copy.createAnotherRestaurant}
            title={copy.addRestaurantTitle}
            description={copy.addRestaurantDescription}
            actionTone="secondary"
            embed
            onSubmit={onCreateRestaurant}
          />
        ) : (
          <div className="rounded-[1.3rem] border border-dashed border-border-light/80 bg-bg-light/60 p-4 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/45 dark:text-text-silver-dark">
            {copy.addRestaurantDescription}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

export function ProductWorkspace({
  route,
  isGuidedOnboardingFlow,
  copy,
  restaurants,
  selectedRestaurantId,
  selectedRestaurantDetail,
  restaurantLoading,
  restaurantError,
  dashboard,
  dashboardLoading,
  dashboardError,
  trendPeriod,
  onTrendPeriodChange,
  importPending,
  savePending,
  createPending,
  latestImportRun,
  importRuns,
  importRunsLoading,
  importRunsError,
  reviews,
  reviewsLoading,
  reviewsError,
  reviewFilters,
  onApplyReviewFilters,
  onClearReviewFilters,
  onReviewPageChange,
  onSelectRestaurant,
  onNavigate,
  onCreateRestaurant,
  onSaveRestaurant,
  onImportReviews,
}: ProductWorkspaceProps) {
  const { language } = useLanguage()
  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? restaurants[0] ?? null
  const hasSource = Boolean(selectedRestaurantDetail?.googleMapUrl ?? currentRestaurant?.googleMapUrl)
  const currentRestaurantAddress = selectedRestaurantDetail?.address?.trim()
  const hasMultipleRestaurants = restaurants.length > 1
  const navItems = [
    {
      routeId: '/app' as const,
      label: copy.navDashboard,
      icon: 'space_dashboard',
    },
    {
      routeId: '/app/reviews' as const,
      label: copy.navReviews,
      icon: 'rate_review',
    },
    {
      routeId: '/app/settings' as const,
      label: copy.navSettings,
      icon: 'settings',
    },
  ]

  if (isGuidedOnboardingFlow) {
    return (
      <main
        id="main-content"
        className="landing-theme relative min-h-screen overflow-hidden bg-[#140f0c] pb-0 pt-0"
      >
        {restaurantError ? (
          <div className="relative z-20 mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-28 xl:px-10">
            <StatusMessage tone="error">{restaurantError}</StatusMessage>
          </div>
        ) : null}
        <OnboardingPanel
          copy={copy}
          restaurant={currentRestaurant}
          detail={selectedRestaurantDetail}
          createPending={createPending}
          savePending={savePending}
          importPending={importPending}
          latestImportRun={latestImportRun}
          importRunsLoading={importRunsLoading}
          importRunsError={importRunsError || dashboardError}
          onBack={() => {
            window.location.hash = '#/'
          }}
          onCreateRestaurant={onCreateRestaurant}
          onSaveRestaurant={onSaveRestaurant}
          onImportReviews={onImportReviews}
        />
      </main>
    )
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-bg-light pb-16 pt-24 dark:bg-bg-dark sm:pt-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-10">
        <div className="grid gap-6 xl:grid-cols-[264px_minmax(0,1fr)]">
            <aside className="hidden xl:grid xl:gap-4 xl:self-start xl:sticky xl:top-28">
              <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/90 p-4 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/84">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                  {copy.operationalPrompt}
                </div>
                <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                  {copy.shellDescription}
                </p>
                <div className="mt-4 grid gap-2">
                  {navItems.map((item) => {
                    const isActive = route === item.routeId

                    return (
                      <button
                        key={item.routeId}
                        type="button"
                        className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-primary/35 bg-primary/12 shadow-[0_12px_24px_-18px_rgba(212,175,55,0.7)]'
                            : 'border-border-light/70 bg-bg-light/70 hover:border-primary/35 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
                        }`}
                        onClick={() => onNavigate(item.routeId)}
                      >
                        <span className="material-symbols-outlined text-[20px] text-primary">
                          {item.icon}
                        </span>
                        <span className="text-sm font-semibold text-text-charcoal dark:text-white">
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/84">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                      {copy.currentRestaurant}
                    </div>
                    {hasMultipleRestaurants ? (
                      <div className="mt-4">
                        <RestaurantSwitcher
                          copy={copy}
                          restaurants={restaurants}
                          currentRestaurant={currentRestaurant}
                          onSelectRestaurant={onSelectRestaurant}
                          showLabel={false}
                          compact
                        />
                      </div>
                    ) : (
                      <>
                        <h2 className="mt-3 text-[1.45rem] font-black tracking-tight text-text-charcoal dark:text-white">
                          {currentRestaurant?.name ?? copy.anonymousGuest}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                          {currentRestaurantAddress || copy.shellDescription}
                        </p>
                      </>
                    )}
                  </div>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]">storefront</span>
                  </span>
                </div>

                {hasMultipleRestaurants && currentRestaurantAddress ? (
                  <p className="mt-4 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                    {currentRestaurantAddress}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/75 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      {hasSource ? 'task_alt' : 'warning'}
                    </span>
                    {hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/75 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    <span className="material-symbols-outlined text-[16px] text-primary">rate_review</span>
                    {formatNumber(currentRestaurant?.totalReviews ?? 0, language)} {copy.navReviews}
                  </span>
                </div>

                <div className="mt-5 border-t border-border-light/70 pt-5 dark:border-border-dark/80">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                    {copy.connectionHealth}
                  </div>
                  <div className="grid gap-2">
                    <SidebarStatusPill
                      icon="verified_user"
                      label={copy.protectedAccess}
                    />
                    <SidebarStatusPill
                      icon="lan"
                      label={copy.restaurantScoped}
                    />
                  </div>
                </div>
              </section>

            </aside>

            <section className="grid gap-6">
              <div className="grid gap-4 xl:hidden">
                <section className="rounded-[1.5rem] border border-border-light/70 bg-surface-white/90 p-4 shadow-[0_16px_50px_-36px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/84">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                        {copy.currentRestaurant}
                      </div>
                      {!hasMultipleRestaurants ? (
                        <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                          {currentRestaurant?.name ?? copy.anonymousGuest}
                        </div>
                      ) : null}
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[18px]">storefront</span>
                    </span>
                  </div>

                  {hasMultipleRestaurants ? (
                    <RestaurantSwitcher
                      copy={copy}
                      restaurants={restaurants}
                      currentRestaurant={currentRestaurant}
                      onSelectRestaurant={onSelectRestaurant}
                      showLabel={false}
                      compact
                    />
                  ) : null}

                  {currentRestaurantAddress ? (
                    <p className="mt-3 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {currentRestaurantAddress}
                    </p>
                  ) : null}

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {navItems.map((item) => {
                      const isActive = route === item.routeId

                      return (
                        <button
                          key={item.routeId}
                          type="button"
                          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                            isActive
                              ? 'border-primary/35 bg-primary/12 text-primary'
                              : 'border-border-light/70 bg-bg-light/70 text-text-charcoal hover:border-primary/35 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55 dark:text-white'
                          }`}
                          onClick={() => onNavigate(item.routeId)}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <SidebarStatusPill
                      icon={hasSource ? 'task_alt' : 'warning'}
                      label={hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration}
                      tone={hasSource ? 'success' : 'warning'}
                    />
                    <SidebarStatusPill icon="verified_user" label={copy.protectedAccess} />
                  </div>
                </section>
              </div>

              {restaurantError ? <StatusMessage tone="error">{restaurantError}</StatusMessage> : null}
              {restaurantLoading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

              {route === '/app' ? (
                <DashboardPanel
                  copy={copy}
                  detail={selectedRestaurantDetail}
                  dashboard={dashboard}
                  loading={dashboardLoading}
                  error={dashboardError}
                  trendPeriod={trendPeriod}
                  importPending={importPending}
                  latestImportRun={latestImportRun}
                  importRunsLoading={importRunsLoading}
                  importRunsError={importRunsError}
                  language={language}
                  onTrendPeriodChange={onTrendPeriodChange}
                  onImportReviews={onImportReviews}
                  onNavigate={onNavigate}
                />
              ) : route === '/app/reviews' ? (
                <ReviewsPanel
                  copy={copy}
                  detail={selectedRestaurantDetail}
                  reviews={reviews}
                  loading={reviewsLoading}
                  error={reviewsError}
                  reviewFilters={reviewFilters}
                  language={language}
                  onApplyReviewFilters={onApplyReviewFilters}
                  onClearReviewFilters={onClearReviewFilters}
                  onReviewPageChange={onReviewPageChange}
                />
              ) : (
                <SettingsPanel
                  copy={copy}
                  detail={selectedRestaurantDetail}
                  pending={savePending}
                  createPending={createPending}
                  latestImportRun={latestImportRun}
                  importRuns={importRuns}
                  importRunsLoading={importRunsLoading}
                  importRunsError={importRunsError}
                  language={language}
                  onCreateRestaurant={onCreateRestaurant}
                  onSaveRestaurant={onSaveRestaurant}
                />
              )}
            </section>
          </div>
      </div>
    </main>
  )
}
