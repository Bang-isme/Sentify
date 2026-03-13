import { useEffect, useRef, useState } from 'react'
import type { RestaurantDetail, ReviewListResponse, ReviewsQuery } from '../../../lib/api'
import type { ProductUiCopy } from '../../../content/productUiCopy'
import { isValidDateRange } from '../../../lib/validation'
import {
  EmptyPanel,
  PageIntro,
  SectionCard,
  StatusMessage,
} from './shared'
import {
  formatNumber,
  formatRating,
  formatReviewDate,
  getReviewToneClasses,
} from './shared-utils'

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

function NativeFieldShell({
  icon,
  children,
  open = false,
}: {
  icon: string
  children: React.ReactNode
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
    { value: '5', label: `5 \u2605` },
    { value: '4', label: `4 \u2605` },
    { value: '3', label: `3 \u2605` },
    { value: '2', label: `2 \u2605` },
    { value: '1', label: `1 \u2605` },
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

export function ReviewsPanel({
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
        ) : reviews && reviews.data.length > 0 ? (
          <div className="grid gap-4">
            {reviews.data.map((review) => (
              <article
                key={review.id}
                className="rounded-[1.5rem] border border-border-light/70 bg-surface-white/85 p-5 shadow-[0_18px_48px_-40px_rgba(0,0,0,0.45)] dark:border-border-dark/80 dark:bg-surface-dark/70"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      <span className="size-2 rounded-full bg-primary"></span>
                      {copy.reviewEvidence}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full border border-border-light/70 bg-bg-light/70 text-sm font-bold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                        {review.rating}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                          {review.authorName || copy.anonymousGuest}
                        </div>
                        <div className="text-xs text-text-silver-light dark:text-text-silver-dark">
                          {formatReviewDate(review.reviewDate, language, copy.noSourceDate)}
                        </div>
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
