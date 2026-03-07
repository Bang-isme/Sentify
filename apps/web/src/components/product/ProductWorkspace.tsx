import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type {
  ComplaintKeyword,
  CreateRestaurantInput,
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

function PageIntro({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <section className="rounded-[1.8rem] border border-border-light/70 bg-surface-white/88 p-6 shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-[1.9rem] font-black tracking-tight text-text-charcoal dark:text-white">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/88 p-6 shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight text-text-charcoal dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
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
      className={`rounded-[1.4rem] border p-5 ${
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

function RestaurantSetupForm({
  copy,
  pending,
  actionLabel,
  title,
  description,
  onSubmit,
}: {
  copy: ProductUiCopy['app']
  pending: boolean
  actionLabel: string
  title: string
  description: string
  onSubmit: (input: CreateRestaurantInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [googleMapUrl, setGoogleMapUrl] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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

    if (trimmedGoogleMapUrl) {
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
    await onSubmit({
      name: trimmedName,
      address: trimmedAddress || undefined,
      googleMapUrl: trimmedGoogleMapUrl || undefined,
    })

    setFieldErrors({})
    setName('')
    setAddress('')
    setGoogleMapUrl('')
  }

  return (
    <SectionCard title={title} description={description}>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
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
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
          >
            {pending ? `${actionLabel}...` : actionLabel}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

function RestaurantSwitcher({
  copy,
  restaurants,
  currentRestaurant,
  onSelectRestaurant,
}: {
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  currentRestaurant: RestaurantMembership | null
  onSelectRestaurant: (restaurantId: string) => void
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
      <div className="rounded-[1.3rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherLabel}
        </div>
        <div className="mt-3 text-base font-bold text-text-charcoal dark:text-white">
          {currentRestaurant.name}
        </div>
        <div className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherReadonly}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
        {copy.restaurantSwitcherLabel}
      </div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-[1.3rem] border border-border-light/80 bg-bg-light/70 px-4 py-4 text-left transition hover:border-primary/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-border-dark dark:bg-bg-dark/55"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div>
          <div className="text-base font-bold text-text-charcoal dark:text-white">
            {currentRestaurant.name}
          </div>
          <div className="mt-1 text-sm text-text-silver-light dark:text-text-silver-dark">
            {copy.restaurantSwitcherHint}
          </div>
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
        className={`absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 rounded-[1.3rem] border border-border-light/80 bg-surface-white/96 p-2 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark dark:bg-surface-dark/96 ${
          isOpen
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
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
  createPending,
  onCreateRestaurant,
}: {
  copy: ProductUiCopy['app']
  createPending: boolean
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
}) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-border-light/70 bg-surface-white/88 p-8 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.32)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          <span className="size-2 rounded-full bg-primary"></span>
          {copy.onboardingEyebrow}
        </div>
        <h1 className="mt-5 text-[2rem] font-black tracking-tight text-text-charcoal dark:text-white md:text-[2.3rem]">
          {copy.onboardingTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-text-silver-light dark:text-text-silver-dark">
          {copy.onboardingDescription}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {copy.onboardingSteps.map((step, index) => (
            <div
              key={step}
              className="rounded-[1.4rem] border border-border-light/70 bg-bg-light/70 p-5 dark:border-border-dark dark:bg-bg-dark/55"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                {String(index + 1).padStart(2, '0')}
              </div>
              <p className="mt-3 text-sm leading-7 text-text-charcoal dark:text-white">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <RestaurantSetupForm
        copy={copy}
        pending={createPending}
        actionLabel={copy.createRestaurant}
        title={copy.setupTitle}
        description={copy.setupDescription}
        onSubmit={onCreateRestaurant}
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
  language: string
  onTrendPeriodChange: (period: TrendPeriod) => void
  onImportReviews: () => Promise<void>
  onNavigate: (route: '/app' | '/app/reviews' | '/app/settings') => void
}) {
  const kpi = dashboard.kpi ?? detail?.insightSummary ?? null
  const hasSource = Boolean(detail?.googleMapUrl)

  return (
    <div className="grid gap-6">
      <PageIntro
        title={copy.dashboardTitle}
        description={copy.dashboardDescription}
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
                className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary dark:border-border-dark dark:text-white"
                onClick={() => onNavigate('/app/settings')}
              >
                {copy.dashboardSecondaryCta}
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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={copy.totalReviews}
          value={formatNumber(kpi?.totalReviews ?? 0, language)}
        />
        <MetricCard label={copy.averageRating} value={formatRating(kpi?.averageRating ?? 0, language)} />
        <MetricCard
          label={copy.negativeShare}
          value={formatPercentage(kpi?.negativePercentage ?? 0, language)}
        />
        <SectionCard title={copy.sourceReadiness}>
          <div className="grid gap-3 text-sm">
            <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
              {hasSource ? copy.sourceReady : copy.sourceMissing}
            </div>
            <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
              {hasSource ? copy.importReady : copy.importBlocked}
            </div>
          </div>
        </SectionCard>
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

  return (
    <div className="grid gap-6">
      <PageIntro title={copy.reviewsTitle} description={copy.reviewsDescription} />

      <SectionCard title={copy.reviewFilters}>
        {filterError ? <StatusMessage tone="error">{filterError}</StatusMessage> : null}
        <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
          <label
            htmlFor="review-filter-rating"
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{copy.filterRating}</span>
            <select
              id="review-filter-rating"
              value={draftFilters.rating ?? ''}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  rating: event.target.value || undefined,
                }))
              }
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="">{copy.allRatings}</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <label
            htmlFor="review-filter-from"
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{copy.filterFrom}</span>
            <input
              id="review-filter-from"
              value={draftFilters.from ?? ''}
              onChange={(event) =>
                {
                  setFilterError(null)
                  setDraftFilters((current) => ({
                    ...current,
                    from: event.target.value || undefined,
                  }))
                }
              }
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              type="date"
            />
          </label>
          <label
            htmlFor="review-filter-to"
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{copy.filterTo}</span>
            <input
              id="review-filter-to"
              value={draftFilters.to ?? ''}
              onChange={(event) =>
                {
                  setFilterError(null)
                  setDraftFilters((current) => ({
                    ...current,
                    to: event.target.value || undefined,
                  }))
                }
              }
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              type="date"
            />
          </label>
          <button
            type="button"
            className="mt-auto inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark dark:text-bg-dark"
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
            className="mt-auto inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary dark:border-border-dark dark:text-white"
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
      </SectionCard>

      <SectionCard title={copy.reviewEvidence}>
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

        {loading ? (
          <StatusMessage>{copy.loadingReviews}</StatusMessage>
        ) : reviews?.data.length ? (
          <div className="grid gap-4">
            {reviews.data.map((review) => (
              <article
                key={review.id}
                className="rounded-[1.4rem] border border-border-light/70 bg-bg-light/75 p-5 dark:border-border-dark dark:bg-bg-dark/55"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {review.authorName || copy.anonymousGuest}
                    </div>
                    <div className="mt-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                      {formatReviewDate(review.reviewDate, language, copy.noSourceDate)}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-bold text-primary">
                    <span>{formatRating(review.rating, language)}</span>
                    {review.sentiment ? (
                      <>
                        <span>|</span>
                        <span>{copy.sentimentLabels[review.sentiment]}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-text-charcoal dark:text-text-silver-dark">
                  {review.content || copy.noReviewContent}
                </p>
              </article>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-light pt-4 dark:border-border-dark">
              <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                {formatNumber(reviews.pagination.total, language)} {copy.paginationItems}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:text-white"
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
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:text-white"
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
    <SectionCard title={copy.settingsSourceTitle} description={copy.settingsSourceDescription}>
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
  onCreateRestaurant,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail | null
  pending: boolean
  createPending: boolean
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
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
      <PageIntro title={copy.settingsTitle} description={copy.settingsDescription} />

      <div className="grid gap-6 xl:grid-cols-2">
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

      <RestaurantSetupForm
        copy={copy}
        pending={createPending}
        actionLabel={copy.createAnotherRestaurant}
        title={copy.addRestaurantTitle}
        description={copy.addRestaurantDescription}
        onSubmit={onCreateRestaurant}
      />
    </div>
  )
}

export function ProductWorkspace({
  route,
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
  const hasRestaurants = restaurants.length > 0
  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? restaurants[0] ?? null
  const hasSource = Boolean(selectedRestaurantDetail?.googleMapUrl ?? currentRestaurant?.googleMapUrl)

  return (
    <main id="main-content" className="min-h-screen bg-bg-light pb-16 pt-28 dark:bg-bg-dark">
      <div className="mx-auto max-w-7xl px-6 xl:px-10">
        {!hasRestaurants ? (
          <div className="grid gap-6">
            {restaurantError ? <StatusMessage tone="error">{restaurantError}</StatusMessage> : null}
            <OnboardingPanel
              copy={copy}
              createPending={createPending}
              onCreateRestaurant={onCreateRestaurant}
            />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="grid gap-6 self-start xl:sticky xl:top-28">
              <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/88 p-6 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                  {copy.operationalPrompt}
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-text-charcoal dark:text-white">
                  {copy.shellTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                  {copy.shellDescription}
                </p>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-[1.3rem] border border-border-light/70 bg-bg-light/75 p-4 dark:border-border-dark dark:bg-bg-dark/60">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {copy.currentRestaurant}
                    </div>
                    <div className="mt-3">
                      <RestaurantSwitcher
                        copy={copy}
                        restaurants={restaurants}
                        currentRestaurant={currentRestaurant}
                        onSelectRestaurant={onSelectRestaurant}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-border-light/70 bg-bg-light/75 p-4 dark:border-border-dark dark:bg-bg-dark/60">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {copy.connectionHealth}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-2 text-sm text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white">
                        {hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration}
                      </div>
                      <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-2 text-sm text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white">
                        {copy.protectedAccess}
                      </div>
                      <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-3 py-2 text-sm text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white">
                        {copy.restaurantScoped}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/88 p-4 dark:border-border-dark/70 dark:bg-surface-dark/82">
                <div className="grid gap-2">
                  {[
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
                  ].map((item) => {
                    const isActive = route === item.routeId

                    return (
                      <button
                        key={item.routeId}
                        type="button"
                        className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-primary/35 bg-primary/10'
                            : 'border-border-light/70 hover:border-primary/35 dark:border-border-dark'
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
            </aside>

            <section className="grid gap-6">
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
                  language={language}
                  onTrendPeriodChange={onTrendPeriodChange}
                  onImportReviews={onImportReviews}
                  onNavigate={onNavigate}
                />
              ) : route === '/app/reviews' ? (
                <ReviewsPanel
                  copy={copy}
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
                  onCreateRestaurant={onCreateRestaurant}
                  onSaveRestaurant={onSaveRestaurant}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
