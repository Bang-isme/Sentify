import { useEffect, useState } from 'react'
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
import {
  EmptyPanel,
  PageIntro,
  SectionCard,
  StatusMessage,
} from '../../../components/product/workspace/shared'

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
    return 'Not available'
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

  useEffect(() => {
    setPreviewUrl(detail?.googleMapUrl ?? '')
    setSourceUrl(detail?.googleMapUrl ?? '')
  }, [detail?.googleMapUrl, restaurantId])

  async function loadSources(preferredSourceId?: string | null) {
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
  }

  async function loadRuns(sourceId: string, preferredRunId?: string | null) {
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
  }

  async function loadRunDetail(runId: string) {
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
  }

  useEffect(() => {
    void loadSources()
  }, [restaurantId])

  useEffect(() => {
    if (!selectedSourceId) {
      setRunsResponse(null)
      setSelectedRunId(null)
      setSelectedRun(null)
      return
    }

    void loadRuns(selectedSourceId)
  }, [selectedSourceId])

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null)
      return
    }

    void loadRunDetail(selectedRunId)
  }, [selectedRunId])

  async function handlePreview() {
    if (!restaurantId || !previewUrl.trim()) {
      setError('Google Maps URL is required.')
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
      setError('Google Maps URL is required.')
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
      setError('Select a source before creating a run.')
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

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={labels.navReviewCrawl}
        title={labels.reviewCrawlTitle}
        description={labels.reviewCrawlDescription}
        meta={[
          {
            icon: 'storefront',
            label: detail?.name ?? 'Restaurant',
          },
          {
            icon: detail?.googleMapUrl ? 'task_alt' : 'warning',
            label: detail?.googleMapUrl ? 'Google Maps source configured' : 'Google Maps source missing',
            tone: detail?.googleMapUrl ? 'success' : 'warning',
          },
        ]}
      />

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {notice ? <StatusMessage>{notice}</StatusMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title={labels.previewTitle} description={labels.previewDescription} tone="accent">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white md:col-span-2">
              <span>{labels.syncUrlLabel}</span>
              <input
                value={previewUrl}
                onChange={(event) => setPreviewUrl(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                placeholder="https://maps.google.com/..."
                type="url"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
              <span>{labels.syncMaxPagesLabel}</span>
              <input
                value={previewMaxPages}
                onChange={(event) => setPreviewMaxPages(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
              <span>{labels.syncMaxReviewsLabel}</span>
              <input
                value={previewMaxReviews}
                onChange={(event) => setPreviewMaxReviews(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={actionPending || !restaurantId}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
              onClick={() => void handlePreview()}
            >
              {labels.previewAction}
            </button>
            {previewResult ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                <span className="material-symbols-outlined text-[16px] text-primary">preview</span>
                <span>{formatCount(previewResult.intake.validItemCount, language)} valid review(s)</span>
              </div>
            ) : null}
          </div>

          {previewResult ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    Crawl status
                  </div>
                  <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                    {previewResult.crawl.status}
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    Completeness
                  </div>
                  <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                    {previewResult.crawl.completeness}
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    Extracted
                  </div>
                  <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                    {formatCount(previewResult.crawl.totalReviewsExtracted, language)}
                  </div>
                </div>
              </div>

              {previewResult.crawl.warnings.length ? (
                <div className="rounded-[1.25rem] border border-amber-300/35 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-100">
                  <div className="mb-2 font-semibold">{labels.previewWarningsTitle}</div>
                  {previewResult.crawl.warnings.join(' ')}
                </div>
              ) : null}

              <div className="grid gap-3">
                {previewResult.reviews.slice(0, 5).map((review, index) => (
                  <div key={`${review.externalReviewKey ?? 'review'}-${index}`} className="rounded-[1.25rem] border border-border-light/70 bg-surface-white/85 p-4 dark:border-border-dark dark:bg-surface-dark/70">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                        {review.author?.name ?? 'Anonymous reviewer'}
                      </div>
                      <div className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                        Rating {review.rating}
                      </div>
                      <div className="text-xs text-text-silver-light dark:text-text-silver-dark">
                        {formatDateTime(review.publishedAt ?? null, language)}
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-text-charcoal dark:text-white">
                      {review.text ?? 'No review text returned.'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title={labels.sourceConfigTitle} description={labels.sourceConfigDescription}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white md:col-span-2">
              <span>{labels.syncUrlLabel}</span>
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                placeholder="https://maps.google.com/..."
                type="url"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
              <span>{labels.sourceLanguageLabel}</span>
              <input
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
              <span>{labels.sourceRegionLabel}</span>
              <input
                value={sourceRegion}
                onChange={(event) => setSourceRegion(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                placeholder="Optional"
              />
            </label>
            <label className="flex items-center gap-3 rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 px-4 py-3 text-sm font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
              <input
                checked={syncEnabled}
                onChange={(event) => setSyncEnabled(event.target.checked)}
                className="size-4 rounded border-border-light text-primary focus:ring-primary"
                type="checkbox"
              />
              <span>{labels.sourceSyncEnabledLabel}</span>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
              <span>{labels.sourceSyncIntervalLabel}</span>
              <input
                value={syncIntervalMinutes}
                onChange={(event) => setSyncIntervalMinutes(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                inputMode="numeric"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="mt-4">
            <button
              type="button"
              disabled={actionPending || !restaurantId}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-border-dark dark:text-white"
              onClick={() => void handleUpsertSource()}
            >
              {labels.upsertSourceAction}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title={labels.sourcesTitle} description={labels.sourcesDescription}>
          {loadingSources ? <StatusMessage>Loading sources...</StatusMessage> : null}
          {!loadingSources && !sourcesResponse?.sources.length ? <EmptyPanel message={labels.noSources} /> : null}
          {!loadingSources && sourcesResponse?.sources.length ? (
            <div className="grid gap-3">
              {sourcesResponse.sources.map((source) => {
                const isActive = source.id === selectedSourceId

                return (
                  <button
                    key={source.id}
                    type="button"
                    className={`rounded-[1.35rem] border p-4 text-left transition ${
                      isActive
                        ? 'border-primary/35 bg-primary/8'
                        : 'border-border-light/70 bg-bg-light/70 hover:border-primary/25 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
                    }`}
                    onClick={() => setSelectedSourceId(source.id)}
                  >
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {source.placeName ?? 'Google Maps source'}
                    </div>
                    <div className="mt-2 text-xs leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {source.inputUrl}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </SectionCard>

        <div className="grid gap-6">
          <SectionCard title={labels.runControlTitle} description={labels.runControlDescription}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 px-4 py-3 text-sm font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                {labels.selectedSourceLabel}:{' '}
                {selectedSourceId
                  ? sourcesResponse?.sources.find((source) => source.id === selectedSourceId)?.placeName ?? 'Selected source'
                  : 'None'}
              </div>
              <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
                <span>{labels.runStrategyLabel}</span>
                <select
                  value={runStrategy}
                  onChange={(event) => setRunStrategy(event.target.value as ReviewCrawlRunStrategy)}
                  className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                >
                  <option value="INCREMENTAL">{labels.strategies.INCREMENTAL}</option>
                  <option value="BACKFILL">{labels.strategies.BACKFILL}</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
                <span>{labels.runPriorityLabel}</span>
                <select
                  value={runPriority}
                  onChange={(event) => setRunPriority(event.target.value as ReviewCrawlRunPriority)}
                  className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                >
                  <option value="HIGH">{labels.priorities.HIGH}</option>
                  <option value="NORMAL">{labels.priorities.NORMAL}</option>
                  <option value="LOW">{labels.priorities.LOW}</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
                <span>{labels.syncMaxPagesLabel}</span>
                <input
                  value={runMaxPages}
                  onChange={(event) => setRunMaxPages(event.target.value)}
                  className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                  inputMode="numeric"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
                <span>{labels.syncMaxReviewsLabel}</span>
                <input
                  value={runMaxReviews}
                  onChange={(event) => setRunMaxReviews(event.target.value)}
                  className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                  inputMode="numeric"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
                <span>{labels.runPageSizeLabel}</span>
                <input
                  value={runPageSize}
                  onChange={(event) => setRunPageSize(event.target.value)}
                  className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                  inputMode="numeric"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
                <span>{labels.runDelayLabel}</span>
                <input
                  value={runDelayMs}
                  onChange={(event) => setRunDelayMs(event.target.value)}
                  className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
                  inputMode="numeric"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={actionPending || !selectedSourceId}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
                onClick={() => void handleCreateRun()}
              >
                {labels.createRunAction}
              </button>
              <button
                type="button"
                disabled={actionPending || !selectedRunId}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-border-dark dark:text-white"
                onClick={() => void handleRunAction('refresh')}
              >
                {labels.refreshRunAction}
              </button>
              <button
                type="button"
                disabled={actionPending || !selectedRunId}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-border-dark dark:text-white"
                onClick={() => void handleRunAction('cancel')}
              >
                {labels.cancelAction}
              </button>
              <button
                type="button"
                disabled={actionPending || !selectedRunId}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-border-dark dark:text-white"
                onClick={() => void handleRunAction('resume')}
              >
                {labels.resumeAction}
              </button>
              <button
                type="button"
                disabled={actionPending || !selectedRunId}
                className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400/45 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-55 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200"
                onClick={() => void handleRunAction('materialize')}
              >
                {labels.materializeAction}
              </button>
            </div>
          </SectionCard>

          <SectionCard title={labels.runsTitle} description={labels.runsDescription}>
            {loadingRuns ? <StatusMessage>Loading runs...</StatusMessage> : null}
            {!loadingRuns && !runsResponse?.runs.length ? <EmptyPanel message={labels.noRuns} /> : null}
            {!loadingRuns && runsResponse?.runs.length ? (
              <div className="grid gap-3">
                {runsResponse.runs.map((run) => {
                  const isActive = run.id === selectedRunId

                  return (
                    <button
                      key={run.id}
                      type="button"
                      className={`rounded-[1.3rem] border p-4 text-left transition ${
                        isActive
                          ? 'border-primary/35 bg-primary/8'
                          : 'border-border-light/70 bg-bg-light/70 hover:border-primary/25 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
                      }`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                          {labels.strategies[run.strategy] ?? run.strategy}
                        </div>
                        <span className="rounded-full border border-border-light/70 bg-surface-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
                          {labels.statuses[run.status] ?? run.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                        <div>Extracted {formatCount(run.extractedCount, language)} review(s)</div>
                        <div>Updated {formatDateTime(run.updatedAt, language)}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title={labels.runDetailTitle} description={labels.runDetailDescription}>
            {loadingRunDetail ? <StatusMessage>Loading run detail...</StatusMessage> : null}
            {!loadingRunDetail && !selectedRun ? <EmptyPanel message={labels.noRunDetail} /> : null}
            {!loadingRunDetail && selectedRun ? (
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Status
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {labels.statuses[selectedRun.status] ?? selectedRun.status}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Coverage
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {selectedRun.crawlCoverage?.completeness ?? 'Unknown'}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Extracted
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {formatCount(selectedRun.extractedCount, language)}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Updated
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {formatDateTime(selectedRun.updatedAt, language)}
                    </div>
                  </div>
                </div>

                {selectedRun.warnings.length ? (
                  <div className="rounded-[1.25rem] border border-amber-300/35 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-100">
                    {selectedRun.warnings.join(' ')}
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
