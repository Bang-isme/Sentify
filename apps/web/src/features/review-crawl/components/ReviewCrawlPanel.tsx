import { useCallback, useEffect, useState } from 'react'
import {
  ApiClientError,
  cancelReviewCrawlRun,
  createReviewCrawlRun,
  getReviewCrawlRun,
  listReviewOpsSourceRuns,
  listReviewOpsSources,
  materializeReviewCrawlRun,
  previewGoogleMapsReviews,
  resumeReviewCrawlRun,
  upsertReviewCrawlSource,
  type RestaurantDetail,
  type ReviewCrawlPreviewResult,
  type ReviewCrawlRun,
  type ReviewCrawlRunPriority,
  type ReviewCrawlRunStrategy,
  type ReviewOpsRunListResponse,
  type ReviewOpsSourcesResponse,
} from '../../../lib/api'
import { getAdminOpsLabels } from '../../admin-ops/adminOpsLabels'
import { AdminCard, AdminDataCell, AdminStatusMessage } from '../../admin-shell/components/AdminPrimitives'

const solidActionButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:border-slate-800 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 dark:border-white dark:bg-white dark:text-slate-900 dark:hover:border-slate-200 dark:hover:bg-slate-200 dark:disabled:border-white/10 dark:disabled:bg-white/10 dark:disabled:text-zinc-500'

const secondaryActionButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/5 dark:disabled:border-white/10 dark:disabled:bg-white/5 dark:disabled:text-zinc-500'

const successActionButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-400 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-200 disabled:bg-emerald-50/60 disabled:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30 dark:disabled:border-emerald-500/20 dark:disabled:bg-emerald-500/10 dark:disabled:text-emerald-500'

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

function formatDateTime(value: string | null | undefined, language: string) {
  if (!value) {
    return language.startsWith('vi') ? 'Chưa có dữ liệu' : 'Not available'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatCount(value: number | null | undefined, language: string) {
  return new Intl.NumberFormat(language).format(value ?? 0)
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  const parsed = Number.parseInt(trimmed, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function getStatusBadgeClass(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
    case 'RUNNING':
    case 'COMPLETED':
    case 'READY_TO_PUBLISH':
    case 'PUBLISHED':
      return 'border-emerald-400/28 bg-emerald-400/12 text-emerald-100'
    case 'FAILED':
    case 'CANCELLED':
    case 'DISABLED':
      return 'border-red-400/28 bg-red-400/12 text-red-100'
    default:
      return 'border-amber-300/28 bg-amber-300/12 text-amber-100'
  }
}

function getPriorityBadgeClass(priority?: string | null) {
  switch (priority) {
    case 'HIGH':
      return 'border-red-400/28 bg-red-400/12 text-red-100'
    case 'LOW':
      return 'border-slate-400/18 bg-slate-400/10 text-slate-700 dark:text-zinc-300'
    default:
      return 'border-sky-300/28 bg-sky-300/12 text-sky-100'
  }
}




interface ReviewCrawlPanelProps {
  language: string
  restaurantId: string | null
  detail: RestaurantDetail | null
  onMaterialized: () => void
}

export function ReviewCrawlPanel({
  language,
  restaurantId,
  detail,
  onMaterialized,
}: ReviewCrawlPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const labels = getAdminOpsLabels(language)
  const [sourcesResponse, setSourcesResponse] = useState<ReviewOpsSourcesResponse | null>(null)
  const [runsResponse, setRunsResponse] = useState<ReviewOpsRunListResponse | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<ReviewCrawlRun | null>(null)
  const [previewResult, setPreviewResult] = useState<ReviewCrawlPreviewResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewMaxPages, setPreviewMaxPages] = useState('')
  const [previewMaxReviews, setPreviewMaxReviews] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState(language.slice(0, 2))
  const [sourceRegion, setSourceRegion] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState('')
  const [runStrategy, setRunStrategy] = useState<ReviewCrawlRunStrategy>('INCREMENTAL')
  const [runPriority, setRunPriority] = useState<ReviewCrawlRunPriority>('NORMAL')
  const [runMaxPages, setRunMaxPages] = useState('')
  const [runMaxReviews, setRunMaxReviews] = useState('')
  const [runPageSize, setRunPageSize] = useState('10')
  const [runDelayMs, setRunDelayMs] = useState('600')
  const [loadingSources, setLoadingSources] = useState(false)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingRunDetail, setLoadingRunDetail] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hasManualUrlEdits, setHasManualUrlEdits] = useState(false)

  useEffect(() => {
    setHasManualUrlEdits(false)
  }, [restaurantId])

  useEffect(() => {
    if (hasManualUrlEdits) {
      return
    }

    setPreviewUrl(detail?.googleMapUrl ?? '')
    setSourceUrl(detail?.googleMapUrl ?? '')
  }, [detail?.googleMapUrl, hasManualUrlEdits, restaurantId])

  const loadSources = useCallback(async (preferredSourceId?: string | null) => {
    if (!restaurantId) {
      setSourcesResponse(null)
      setRunsResponse(null)
      setSelectedSourceId(null)
      setSelectedRunId(null)
      setSelectedRun(null)
      return
    }

    setLoadingSources(true)
    setError(null)

    try {
      const nextResponse = await listReviewOpsSources(restaurantId)
      const nextSourceId =
        preferredSourceId && nextResponse.sources.some((source) => source.id === preferredSourceId)
          ? preferredSourceId
          : selectedSourceId && nextResponse.sources.some((source) => source.id === selectedSourceId)
            ? selectedSourceId
            : nextResponse.sources[0]?.id ?? null

      setSourcesResponse(nextResponse)
      setSelectedSourceId(nextSourceId)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setLoadingSources(false)
    }
  }, [restaurantId, selectedSourceId])

  const loadRuns = useCallback(async (sourceId: string, preferredRunId?: string | null) => {
    setLoadingRuns(true)
    setError(null)

    try {
      const nextResponse = await listReviewOpsSourceRuns(sourceId)
      const nextRunId =
        preferredRunId && nextResponse.runs.some((run) => run.id === preferredRunId)
          ? preferredRunId
          : selectedRunId && nextResponse.runs.some((run) => run.id === selectedRunId)
            ? selectedRunId
            : nextResponse.runs[0]?.id ?? null

      setRunsResponse(nextResponse)
      setSelectedRunId(nextRunId)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setLoadingRuns(false)
    }
  }, [selectedRunId])

  const loadRunDetail = useCallback(async (runId: string) => {
    setLoadingRunDetail(true)
    setError(null)

    try {
      const nextRun = await getReviewCrawlRun(runId)
      setSelectedRun(nextRun)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setLoadingRunDetail(false)
    }
  }, [])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  useEffect(() => {
    if (!selectedSourceId) {
      setRunsResponse(null)
      setSelectedRunId(null)
      setSelectedRun(null)
      return
    }

    void loadRuns(selectedSourceId)
  }, [loadRuns, selectedSourceId])

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null)
      return
    }

    void loadRunDetail(selectedRunId)
  }, [loadRunDetail, selectedRunId])

  async function handlePreview() {
    if (!restaurantId || !previewUrl.trim()) {
      setError(isVietnamese ? 'Cần nhập URL Google Maps.' : 'Google Maps URL is required.')
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      const nextPreview = await previewGoogleMapsReviews({
        restaurantId,
        url: previewUrl.trim(),
        language: sourceLanguage,
        region: sourceRegion.trim() || undefined,
        pages: parseOptionalInteger(previewMaxPages),
        maxReviews: parseOptionalInteger(previewMaxReviews),
      })

      setPreviewResult(nextPreview)
      setNotice(labels.previewSuccess)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  async function handleUpsertSource() {
    if (!restaurantId || !sourceUrl.trim()) {
      setError(isVietnamese ? 'Cần nhập URL Google Maps.' : 'Google Maps URL is required.')
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      const result = await upsertReviewCrawlSource({
        restaurantId,
        url: sourceUrl.trim(),
        language: sourceLanguage,
        region: sourceRegion.trim() || undefined,
        syncEnabled,
        syncIntervalMinutes: syncEnabled ? parseOptionalInteger(syncIntervalMinutes) : undefined,
      })

      setNotice(labels.sourceUpsertSuccess)
      await loadSources(result.source.id)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  async function handleCreateRun() {
    if (!selectedSourceId) {
      setError(isVietnamese ? 'Hãy chọn nguồn trước khi tạo lần chạy.' : 'Select a source before creating a run.')
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      const run = await createReviewCrawlRun(selectedSourceId, {
        strategy: runStrategy,
        priority: runPriority,
        maxPages: parseOptionalInteger(runMaxPages),
        maxReviews: parseOptionalInteger(runMaxReviews),
        pageSize: parseOptionalInteger(runPageSize),
        delayMs: parseOptionalInteger(runDelayMs),
      })

      setNotice(labels.runCreateSuccess)
      await loadRuns(selectedSourceId, run.id)
      await loadRunDetail(run.id)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  async function handleRunAction(action: 'cancel' | 'resume' | 'materialize' | 'refresh') {
    if (!selectedRunId) {
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      if (action === 'cancel') {
        await cancelReviewCrawlRun(selectedRunId)
      } else if (action === 'resume') {
        await resumeReviewCrawlRun(selectedRunId)
      } else if (action === 'materialize') {
        await materializeReviewCrawlRun(selectedRunId)
        setNotice(labels.materializeSuccess)
        onMaterialized()
      }

      await loadRunDetail(selectedRunId)

      if (selectedSourceId) {
        await loadRuns(selectedSourceId, selectedRunId)
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  const selectedSource =
    sourcesResponse?.sources.find((source) => source.id === selectedSourceId) ?? null
  const sourceCount = sourcesResponse?.sources.length ?? 0
  const runCount = runsResponse?.runs.length ?? 0
  const overdueSourceCount = sourcesResponse?.overdueSourceCount ?? 0
  const latestRun = runsResponse?.runs[0] ?? null
  const previewSample = previewResult?.reviews.slice(0, 4) ?? []

  return (
    <div className="grid gap-3">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] xl:items-end">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
              {labels.reviewCrawlTitle}
            </div>
            <h2 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white sm:text-2xl">
              {detail?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
            </h2>
            <p className="mt-1 max-w-[60ch] text-[13px] leading-6 text-slate-500 dark:text-zinc-400">
              {labels.reviewCrawlDescription}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                <span className="material-symbols-outlined text-sm text-sky-500 dark:text-sky-300">storefront</span>
                {detail?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                <span
                  className={`material-symbols-outlined text-sm ${
                    detail?.googleMapUrl ? 'text-emerald-500 dark:text-emerald-300' : 'text-amber-500 dark:text-amber-300'
                  }`}
                >
                  {detail?.googleMapUrl ? 'task_alt' : 'warning'}
                </span>
                {detail?.googleMapUrl
                  ? isVietnamese
                    ? 'Nguồn Google Maps đã sẵn sàng'
                    : 'Google Maps source configured'
                  : isVietnamese
                    ? 'Thiếu nguồn Google Maps'
                    : 'Google Maps source missing'}
              </span>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            <AdminDataCell label={labels.sourcesTitle} value={formatCount(sourceCount, language)} />
            <AdminDataCell label={labels.runsTitle} value={formatCount(runCount, language)} />
            <AdminDataCell label={labels.overdueLabel} value={formatCount(overdueSourceCount, language)} />
            <AdminDataCell label={labels.latestRunLabel} value={formatCount(
              latestRun?.extractedCount ?? previewResult?.crawl.totalReviewsExtracted ?? 0,
              language,
            )} />
          </div>
        </div>
      </section>
      {error ? <AdminStatusMessage tone="error">{error}</AdminStatusMessage> : null}
      {notice ? <AdminStatusMessage>{notice}</AdminStatusMessage> : null}

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.16fr)_minmax(340px,0.84fr)]">
        <AdminCard title={labels.previewTitle} description={labels.previewDescription}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white md:col-span-2">
              <span>{labels.syncUrlLabel}</span>
              <input
                data-testid="review-crawl-preview-url-input"
                value={previewUrl}
                onChange={(event) => {
                  setHasManualUrlEdits(true)
                  setPreviewUrl(event.target.value)
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                placeholder="https://maps.google.com/..."
                type="url"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span>{labels.syncMaxPagesLabel}</span>
              <input
                data-testid="review-crawl-preview-max-pages-input"
                value={previewMaxPages}
                onChange={(event) => setPreviewMaxPages(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span>{labels.syncMaxReviewsLabel}</span>
              <input
                data-testid="review-crawl-preview-max-reviews-input"
                value={previewMaxReviews}
                onChange={(event) => setPreviewMaxReviews(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="review-crawl-preview-button"
              disabled={actionPending || !restaurantId}
              className={solidActionButtonClass}
              onClick={() => void handlePreview()}
            >
              <span className="material-symbols-outlined text-[18px]">travel_explore</span>
              {labels.previewAction}
            </button>
            {previewResult ? (
              <div
                data-testid="review-crawl-preview-valid-count"
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:border-cyan-300/18 dark:bg-cyan-300/10 dark:text-cyan-200"
              >
                <span className="material-symbols-outlined text-[14px]">preview</span>
                <span>{formatCount(previewResult.intake.validItemCount, language)} valid review(s)</span>
              </div>
            ) : null}
          </div>

          {previewResult ? (
            <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 dark:border-white/6">
              <div className="grid gap-2 sm:grid-cols-3">
                <AdminDataCell label="Crawl status" value={labels.statuses[previewResult.crawl.status] ?? previewResult.crawl.status} />
                <AdminDataCell label="Completeness" value={previewResult.crawl.completeness} />
                <AdminDataCell label="Extracted" value={formatCount(previewResult.crawl.totalReviewsExtracted, language)} />
              </div>

              {previewResult.crawl.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <div className="mb-2 font-semibold">{labels.previewWarningsTitle}</div>
                  {previewResult.crawl.warnings.join(' ')}
                </div>
              ) : null}

              <div className="grid gap-2 md:grid-cols-2">
                {previewSample.map((review, index) => (
                  <div key={`${review.externalReviewKey ?? 'review'}-${index}`} className="rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 dark:border-white/10 dark:bg-[#18181b] dark:hover:border-white/20 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {review.author?.name ?? 'Anonymous reviewer'}
                      </div>
                      <div className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-zinc-300">
                        Rating {review.rating}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {formatDateTime(review.publishedAt ?? null, language)}
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-700 dark:text-zinc-300">
                      {review.text ?? 'No review text returned.'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
              {isVietnamese ? 'Chưa có dữ liệu xem trước.' : 'No preview data available.'}
            </div>
          )}
        </AdminCard>

        <AdminCard title={labels.sourceConfigTitle} description={labels.sourceConfigDescription}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white md:col-span-2">
              <span>{labels.syncUrlLabel}</span>
              <input
                data-testid="review-crawl-source-url-input"
                value={sourceUrl}
                onChange={(event) => {
                  setHasManualUrlEdits(true)
                  setSourceUrl(event.target.value)
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                placeholder="https://maps.google.com/..."
                type="url"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span>{labels.sourceLanguageLabel}</span>
              <input
                data-testid="review-crawl-source-language-input"
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span>{labels.sourceRegionLabel}</span>
              <input
                data-testid="review-crawl-source-region-input"
                value={sourceRegion}
                onChange={(event) => setSourceRegion(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                placeholder="Optional"
              />
            </label>
            <label className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-transparent flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
              <input
                data-testid="review-crawl-source-sync-enabled"
                checked={syncEnabled}
                onChange={(event) => setSyncEnabled(event.target.checked)}
                className="size-4 rounded border-white/12 bg-transparent text-cyan-300 focus:ring-cyan-300"
                type="checkbox"
              />
              <span>{labels.sourceSyncEnabledLabel}</span>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span>{labels.sourceSyncIntervalLabel}</span>
              <input
                data-testid="review-crawl-source-sync-interval-input"
                value={syncIntervalMinutes}
                onChange={(event) => setSyncIntervalMinutes(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="review-crawl-upsert-source-button"
              disabled={actionPending || !restaurantId}
              className={secondaryActionButtonClass}
              onClick={() => void handleUpsertSource()}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {labels.upsertSourceAction}
            </button>
          </div>
          {selectedSource ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-display text-[17px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-white">
                  {selectedSource.placeName ?? 'Google Maps source'}
                </div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusBadgeClass(selectedSource.status)}`}
                >
                  {labels.statuses[selectedSource.status] ?? selectedSource.status}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-zinc-400 sm:grid-cols-2">
                <div>Last success: {formatDateTime(selectedSource.lastSuccessfulRunAt, language)}</div>
                <div>Next schedule: {formatDateTime(selectedSource.nextScheduledAt, language)}</div>
              </div>
            </div>
          ) : null}
        </AdminCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <AdminCard
          title={labels.sourcesTitle}
          description={labels.sourcesDescription}
          headerAction={
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              {formatCount(sourceCount, language)}
            </span>
          }
        >
          {loadingSources ? <AdminStatusMessage>Loading sources...</AdminStatusMessage> : null}
          {!loadingSources && !sourcesResponse?.sources.length ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">{labels.noSources}</div> : null}
          {!loadingSources && sourcesResponse?.sources.length ? (
            <div className="scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 grid max-h-[340px] gap-2 overflow-y-auto pr-1">
              {sourcesResponse.sources.map((source) => {
                const isActive = source.id === selectedSourceId

                return (
                  <button
                    key={source.id}
                    type="button"
                    data-testid={`review-crawl-source-row-${source.id}`}
                    data-active={isActive ? 'true' : 'false'}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 dark:border-white/10 dark:bg-[#18181b]/60 dark:hover:border-white/20"
                    onClick={() => setSelectedSourceId(source.id)}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                          {source.placeName ?? 'Google Maps source'}
                        </div>
                        <div className="mt-1 text-[12px] leading-6 text-slate-500 dark:text-zinc-400 break-words">
                          {source.inputUrl}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusBadgeClass(source.status)}`}
                      >
                        {labels.statuses[source.status] ?? source.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                      <div>
                        {labels.sourceLanguageLabel}: {source.language || 'n/a'}
                        {source.region ? ` / ${source.region}` : ''}
                      </div>
                      {source.syncEnabled && source.syncIntervalMinutes ? (
                        <div>
                          {labels.sourceSyncIntervalLabel}: {formatCount(source.syncIntervalMinutes, language)}
                        </div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </AdminCard>

        <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="xl:col-span-2">
            <AdminCard
              title={labels.runControlTitle}
              description={labels.runControlDescription}
              headerAction={
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  {selectedSource ? selectedSource.placeName ?? 'Selected source' : 'No source selected'}
                </span>
              }
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
                  {labels.selectedSourceLabel}:{' '}
                  {selectedSource ? selectedSource.placeName ?? 'Selected source' : 'None'}
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{labels.runStrategyLabel}</span>
                  <select
                    data-testid="review-crawl-run-strategy-select"
                    value={runStrategy}
                    onChange={(event) => setRunStrategy(event.target.value as ReviewCrawlRunStrategy)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                  >
                    <option value="INCREMENTAL">{labels.strategies.INCREMENTAL}</option>
                    <option value="BACKFILL">{labels.strategies.BACKFILL}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{labels.runPriorityLabel}</span>
                  <select
                    data-testid="review-crawl-run-priority-select"
                    value={runPriority}
                    onChange={(event) => setRunPriority(event.target.value as ReviewCrawlRunPriority)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                  >
                    <option value="HIGH">{labels.priorities.HIGH}</option>
                    <option value="NORMAL">{labels.priorities.NORMAL}</option>
                    <option value="LOW">{labels.priorities.LOW}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{labels.syncMaxPagesLabel}</span>
                  <input
                    data-testid="review-crawl-run-max-pages-input"
                    value={runMaxPages}
                    onChange={(event) => setRunMaxPages(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                    inputMode="numeric"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{labels.syncMaxReviewsLabel}</span>
                  <input
                    data-testid="review-crawl-run-max-reviews-input"
                    value={runMaxReviews}
                    onChange={(event) => setRunMaxReviews(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                    inputMode="numeric"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{labels.runPageSizeLabel}</span>
                  <input
                    data-testid="review-crawl-run-page-size-input"
                    value={runPageSize}
                    onChange={(event) => setRunPageSize(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                    inputMode="numeric"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{labels.runDelayLabel}</span>
                  <input
                    data-testid="review-crawl-run-delay-input"
                    value={runDelayMs}
                    onChange={(event) => setRunDelayMs(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
                    inputMode="numeric"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="review-crawl-create-run-button"
                  disabled={actionPending || !selectedSourceId}
                  className={solidActionButtonClass}
                  onClick={() => void handleCreateRun()}
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  {labels.createRunAction}
                </button>
                <button
                  type="button"
                  data-testid="review-crawl-refresh-run-button"
                  disabled={actionPending || !selectedRunId}
                  className={secondaryActionButtonClass}
                  onClick={() => void handleRunAction('refresh')}
                >
                  {labels.refreshRunAction}
                </button>
                <button
                  type="button"
                  data-testid="review-crawl-cancel-run-button"
                  disabled={actionPending || !selectedRunId}
                  className={secondaryActionButtonClass}
                  onClick={() => void handleRunAction('cancel')}
                >
                  {labels.cancelAction}
                </button>
                <button
                  type="button"
                  data-testid="review-crawl-resume-run-button"
                  disabled={actionPending || !selectedRunId}
                  className={secondaryActionButtonClass}
                  onClick={() => void handleRunAction('resume')}
                >
                  {labels.resumeAction}
                </button>
                <button
                  type="button"
                  data-testid="review-crawl-materialize-button"
                  disabled={actionPending || !selectedRunId}
                  className={successActionButtonClass}
                  onClick={() => void handleRunAction('materialize')}
                >
                  <span className="material-symbols-outlined text-[18px]">publish</span>
                  {labels.materializeAction}
                </button>
              </div>
            </AdminCard>
          </div>

          <AdminCard
            title={labels.runsTitle}
            description={labels.runsDescription}
            headerAction={
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                {formatCount(runCount, language)}
              </span>
            }
          >
            {loadingRuns ? <AdminStatusMessage>Loading runs...</AdminStatusMessage> : null}
            {!loadingRuns && !runsResponse?.runs.length ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">{labels.noRuns}</div> : null}
            {!loadingRuns && runsResponse?.runs.length ? (
              <div className="scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 grid max-h-[340px] gap-2 overflow-y-auto pr-1">
                {runsResponse.runs.map((run) => {
                  const isActive = run.id === selectedRunId

                  return (
                    <button
                      key={run.id}
                      type="button"
                      data-testid={`review-crawl-run-row-${run.id}`}
                      data-active={isActive ? 'true' : 'false'}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 dark:border-white/10 dark:bg-[#18181b]/60 dark:hover:border-white/20"
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {labels.strategies[run.strategy] ?? run.strategy}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getPriorityBadgeClass(run.priority)}`}
                            >
                              {labels.priorities[run.priority] ?? run.priority}
                            </span>
                          </div>
                          <div className="mt-2 text-[12px] text-slate-500 dark:text-zinc-400">
                            Extracted {formatCount(run.extractedCount, language)} review(s)
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusBadgeClass(run.status)}`}
                        >
                          {labels.statuses[run.status] ?? run.status}
                        </span>
                      </div>
                      <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
                        Updated {formatDateTime(run.updatedAt, language)}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </AdminCard>

          <AdminCard
            title={labels.runDetailTitle}
            description={labels.runDetailDescription}
            headerAction={
              selectedRun ? (
                <span
                  data-testid="review-crawl-run-detail-status"
                  className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusBadgeClass(selectedRun.status)}`}
                >
                  {labels.statuses[selectedRun.status] ?? selectedRun.status}
                </span>
              ) : undefined
            }
          >
            {loadingRunDetail ? <AdminStatusMessage>Loading run detail...</AdminStatusMessage> : null}
            {!loadingRunDetail && !selectedRun ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">{labels.noRunDetail}</div> : null}
            {!loadingRunDetail && selectedRun ? (
              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <AdminDataCell label="Status" value={labels.statuses[selectedRun.status] ?? selectedRun.status} />
                  <AdminDataCell label="Coverage" value={selectedRun.crawlCoverage?.completeness ?? 'Unknown'} />
                  <AdminDataCell label="Extracted" value={formatCount(selectedRun.extractedCount, language)} />
                  <AdminDataCell label="Updated" value={formatDateTime(selectedRun.updatedAt, language)} />
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Run details</div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-zinc-300">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">{labels.runStrategyLabel}</span>
                        <span>{labels.strategies[selectedRun.strategy] ?? selectedRun.strategy}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">{labels.runPriorityLabel}</span>
                        <span>{labels.priorities[selectedRun.priority] ?? selectedRun.priority}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">{labels.runPageSizeLabel}</span>
                        <span>{formatCount(selectedRun.pageSize, language)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">{labels.runDelayLabel}</span>
                        <span>{formatCount(selectedRun.delayMs, language)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Queued</span>
                        <span>{formatDateTime(selectedRun.queuedAt, language)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Started</span>
                        <span>{formatDateTime(selectedRun.startedAt, language)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Finished</span>
                        <span>{formatDateTime(selectedRun.finishedAt, language)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Materialization</div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-zinc-300">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Draft batch</span>
                        <span>{selectedRun.intakeBatch ? selectedRun.intakeBatch.title ?? selectedRun.intakeBatch.id : 'Not created'}</span>
                      </div>
                      {selectedRun.intakeBatch ? (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-slate-500 dark:text-zinc-400">Batch status</span>
                          <span>{labels.statuses[selectedRun.intakeBatch.status] ?? selectedRun.intakeBatch.status}</span>
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Pages fetched</span>
                        <span>{formatCount(selectedRun.pagesFetched, language)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Valid reviews</span>
                        <span>{formatCount(selectedRun.validCount, language)}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 dark:text-zinc-400">Duplicates</span>
                        <span>{formatCount(selectedRun.duplicateCount, language)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedRun.crawlCoverage ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Coverage policy</div>
                    <div className="mt-2">{selectedRun.crawlCoverage.operatorPolicy.summary}</div>
                  </div>
                ) : null}

                {selectedRun.errorMessage ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-700 dark:border-red-400/24 dark:bg-red-500/10 dark:text-red-300">
                    <div className="mb-2 font-semibold">Failure detail</div>
                    {selectedRun.errorMessage}
                  </div>
                ) : null}

                {selectedRun.warnings.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    <div className="mb-2 font-semibold">Warnings</div>
                    {selectedRun.warnings.join(' ')}
                  </div>
                ) : null}
              </div>
            ) : null}
          </AdminCard>
        </div>
      </div>
    </div>
  )
}
