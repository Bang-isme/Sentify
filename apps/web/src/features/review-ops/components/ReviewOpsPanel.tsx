import { useEffect, useMemo, useState } from 'react'
import {
  ApiClientError,
  approveValidBatchItems,
  disableReviewOpsSource,
  enableReviewOpsSource,
  getReviewOpsBatchReadiness,
  getReviewOpsRunDetail,
  listReviewOpsSourceRuns,
  listReviewOpsSources,
  publishReviewOpsBatch,
  syncGoogleMapsToDraft,
  type RestaurantDetail,
  type ReviewOpsBatchReadiness,
  type ReviewOpsRunDetailResponse,
  type ReviewOpsRunListResponse,
  type ReviewOpsSourcesResponse,
  type ReviewCrawlRunPriority,
  type ReviewCrawlRunStrategy,
} from '../../../lib/api'
import { getAdminOpsLabels } from '../../admin-ops/adminOpsLabels'
import {
  EmptyPanel,
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

interface ReviewOpsPanelProps {
  language: string
  restaurantId: string | null
  detail: RestaurantDetail | null
  onPublished: () => void
}

export function ReviewOpsPanel({
  language,
  restaurantId,
  detail,
  onPublished,
}: ReviewOpsPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const labels = getAdminOpsLabels(language)
  const [sourcesResponse, setSourcesResponse] = useState<ReviewOpsSourcesResponse | null>(null)
  const [runsResponse, setRunsResponse] = useState<ReviewOpsRunListResponse | null>(null)
  const [runDetail, setRunDetail] = useState<ReviewOpsRunDetailResponse | null>(null)
  const [batchReadiness, setBatchReadiness] = useState<ReviewOpsBatchReadiness | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [syncUrl, setSyncUrl] = useState('')
  const [syncStrategy, setSyncStrategy] = useState<ReviewCrawlRunStrategy>('INCREMENTAL')
  const [syncPriority, setSyncPriority] = useState<ReviewCrawlRunPriority>('NORMAL')
  const [syncMaxPages, setSyncMaxPages] = useState('')
  const [syncMaxReviews, setSyncMaxReviews] = useState('')
  const [loadingSources, setLoadingSources] = useState(false)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingRunDetail, setLoadingRunDetail] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedSource =
    sourcesResponse?.sources.find((source) => source.id === selectedSourceId) ?? null

  useEffect(() => {
    setSyncUrl(detail?.googleMapUrl ?? '')
  }, [detail?.googleMapUrl, restaurantId])

  async function loadSources(preferredSourceId?: string | null) {
    if (!restaurantId) {
      setSourcesResponse(null)
      setRunsResponse(null)
      setRunDetail(null)
      setBatchReadiness(null)
      setSelectedSourceId(null)
      setSelectedRunId(null)
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
      const nextDetail = await getReviewOpsRunDetail(runId)
      setRunDetail(nextDetail)

      if (nextDetail.run.intakeBatchId) {
        const nextReadiness = await getReviewOpsBatchReadiness(nextDetail.run.intakeBatchId)
        setBatchReadiness(nextReadiness)
      } else {
        setBatchReadiness(null)
      }
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
      setRunDetail(null)
      setBatchReadiness(null)
      setSelectedRunId(null)
      return
    }

    void loadRuns(selectedSourceId)
  }, [selectedSourceId])

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null)
      setBatchReadiness(null)
      return
    }

    void loadRunDetail(selectedRunId)
  }, [selectedRunId])

  async function handleSyncToDraft() {
    if (!restaurantId || !syncUrl.trim()) {
      setError(isVietnamese ? 'Cần nhập URL Google Maps.' : 'Google Maps URL is required.')
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      const result = await syncGoogleMapsToDraft({
        restaurantId,
        url: syncUrl.trim(),
        language: language.slice(0, 2),
        strategy: syncStrategy,
        priority: syncPriority,
        maxPages: parseOptionalInteger(syncMaxPages),
        maxReviews: parseOptionalInteger(syncMaxReviews),
      })

      setNotice(labels.syncSuccess)
      await loadSources(result.source.id)
      await loadRuns(result.source.id, result.run.id)
      await loadRunDetail(result.run.id)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  async function handleSourceStatusToggle(nextAction: 'enable' | 'disable') {
    if (!selectedSourceId) {
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      if (nextAction === 'enable') {
        await enableReviewOpsSource(selectedSourceId)
        setNotice(labels.sourceEnabled)
      } else {
        await disableReviewOpsSource(selectedSourceId)
        setNotice(labels.sourceDisabled)
      }

      await loadSources(selectedSourceId)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  async function handleApproveValid() {
    if (!batchReadiness) {
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      await approveValidBatchItems(batchReadiness.batch.id)
      setNotice(labels.approveSuccess)

      if (selectedRunId) {
        await loadRunDetail(selectedRunId)
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  async function handlePublishBatch() {
    if (!batchReadiness) {
      return
    }

    setActionPending(true)
    setNotice(null)
    setError(null)

    try {
      await publishReviewOpsBatch(batchReadiness.batch.id)
      setNotice(labels.publishSuccess)
      onPublished()

      if (selectedRunId) {
        await loadRunDetail(selectedRunId)
      }

      if (selectedSourceId) {
        await loadSources(selectedSourceId)
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setActionPending(false)
    }
  }

  const queueHealthSummary = useMemo(() => {
    if (!sourcesResponse) {
      return []
    }

    return [
      {
        icon: 'dns',
        label: isVietnamese
          ? `Queue: ${sourcesResponse.queueHealth ? 'đã có tín hiệu' : 'chưa có dữ liệu'}`
          : `Queue: ${sourcesResponse.queueHealth ? 'reported' : 'no data'}`,
      },
      {
        icon: 'memory',
        label: isVietnamese
          ? `Worker: ${sourcesResponse.workerHealth ? 'đã có tín hiệu' : 'chưa có dữ liệu'}`
          : `Worker: ${sourcesResponse.workerHealth ? 'reported' : 'no data'}`,
      },
      {
        icon: 'warning',
        label: isVietnamese
          ? `${formatCount(sourcesResponse.overdueSourceCount, language)} nguồn quá hạn`
          : `${formatCount(sourcesResponse.overdueSourceCount, language)} overdue source(s)`,
      },
    ]
  }, [isVietnamese, language, sourcesResponse])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
          <span className="material-symbols-outlined text-base text-sky-300">storefront</span>
          {detail?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
          <span className={`material-symbols-outlined text-base ${detail?.googleMapUrl ? 'text-emerald-300' : 'text-amber-300'}`}>
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
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
          <span className="material-symbols-outlined text-base text-slate-300">inventory_2</span>
          {isVietnamese
            ? `${formatCount(detail?.datasetStatus.pendingBatchCount, language)} lô đang chờ`
            : `${formatCount(detail?.datasetStatus.pendingBatchCount, language)} pending batch(es)`}
        </span>
      </div>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {notice ? <StatusMessage>{notice}</StatusMessage> : null}

      <SectionCard title={labels.syncCardTitle} description={labels.syncCardDescription} tone="accent">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,0.7fr))]">
          <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{labels.syncUrlLabel}</span>
            <input
              value={syncUrl}
              onChange={(event) => setSyncUrl(event.target.value)}
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              placeholder="https://maps.google.com/..."
              type="url"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{labels.syncStrategyLabel}</span>
            <select
              value={syncStrategy}
              onChange={(event) => setSyncStrategy(event.target.value as ReviewCrawlRunStrategy)}
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              <option value="INCREMENTAL">{labels.strategies.INCREMENTAL}</option>
              <option value="BACKFILL">{labels.strategies.BACKFILL}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{labels.syncPriorityLabel}</span>
            <select
              value={syncPriority}
              onChange={(event) => setSyncPriority(event.target.value as ReviewCrawlRunPriority)}
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
              value={syncMaxPages}
              onChange={(event) => setSyncMaxPages(event.target.value)}
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              inputMode="numeric"
              placeholder="Optional"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white">
            <span>{labels.syncMaxReviewsLabel}</span>
            <input
              value={syncMaxReviews}
              onChange={(event) => setSyncMaxReviews(event.target.value)}
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
            onClick={() => void handleSyncToDraft()}
          >
            {labels.syncAction}
          </button>
          {queueHealthSummary.map((item) => (
            <div
              key={`${item.icon}-${item.label}`}
              className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>

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
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                        {source.placeName ?? 'Google Maps source'}
                      </div>
                      <span className="rounded-full border border-border-light/70 bg-surface-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
                        {labels.statuses[source.status] ?? source.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {source.inputUrl}
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                      <div>
                        {labels.latestRunLabel}: {source.latestRun ? formatDateTime(source.latestRun.updatedAt, language) : 'None'}
                      </div>
                      <div>
                        {labels.openDraftLabel}:{' '}
                        {source.openDraftBatch ? labels.statuses[source.openDraftBatch.status] ?? source.openDraftBatch.status : 'None'}
                      </div>
                      <div>
                        {labels.overdueLabel}: {source.overdueForSync ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </SectionCard>

        <div className="grid gap-6">
          <SectionCard
            title={labels.runsTitle}
            description={labels.runsDescription}
            headerAside={
              selectedSource ? (
                <button
                  type="button"
                  disabled={actionPending}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-border-dark dark:text-white"
                  onClick={() =>
                    void handleSourceStatusToggle(selectedSource.status === 'ACTIVE' ? 'disable' : 'enable')
                  }
                >
                  {selectedSource.status === 'ACTIVE' ? labels.disableAction : labels.enableAction}
                </button>
              ) : null
            }
          >
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
                        <span className="rounded-full border border-border-light/70 bg-surface-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
                          {labels.priorities[run.priority] ?? run.priority}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                        <div>Extracted {formatCount(run.extractedCount, language)} review(s)</div>
                        <div>Warnings {formatCount(run.warningCount, language)}</div>
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
            {!loadingRunDetail && !runDetail ? <EmptyPanel message={labels.noRunDetail} /> : null}
            {!loadingRunDetail && runDetail ? (
              <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Status
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {labels.statuses[runDetail.run.status] ?? runDetail.run.status}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Coverage
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {runDetail.run.crawlCoverage?.completeness ?? 'Unknown'}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Queue job
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {runDetail.queueJob?.state ?? 'No job info'}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Draft batch
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {runDetail.run.intakeBatch ? labels.statuses[runDetail.run.intakeBatch.status] ?? runDetail.run.intakeBatch.status : 'Not materialized'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {runDetail.run.resumable ? (
                    <div className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                      Resumable
                    </div>
                  ) : null}
                  {runDetail.run.materializable ? (
                    <div className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200">
                      Materializable
                    </div>
                  ) : null}
                  <div className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    Extracted {formatCount(runDetail.run.extractedCount, language)}
                  </div>
                  <div className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    Valid {formatCount(runDetail.run.validCount, language)}
                  </div>
                  <div className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    Skipped {formatCount(runDetail.run.skippedCount, language)}
                  </div>
                </div>

                {runDetail.run.warnings.length ? (
                  <div className="rounded-[1.3rem] border border-amber-300/35 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-100">
                    {runDetail.run.warnings.join(' ')}
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          {batchReadiness ? (
            <SectionCard
              title={labels.readinessTitle}
              description={labels.readinessDescription}
              headerAside={
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={actionPending || batchReadiness.bulkApprovableCount === 0}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-border-dark dark:text-white"
                    onClick={() => void handleApproveValid()}
                  >
                    {labels.approveAction}
                  </button>
                  <button
                    type="button"
                    disabled={actionPending || !batchReadiness.publishAllowed}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
                    onClick={() => void handlePublishBatch()}
                  >
                    {labels.publishAction}
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid gap-3">
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Batch status
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {labels.statuses[batchReadiness.batch.status] ?? batchReadiness.batch.status}
                    </div>
                    <div className="mt-3 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                      Publish allowed: {batchReadiness.publishAllowed ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                        Approved
                      </div>
                      <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                        {formatCount(batchReadiness.counts.approvedItems, language)}
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                        Pending
                      </div>
                      <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                        {formatCount(batchReadiness.counts.pendingItems, language)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.blockingReasonsTitle}
                    </div>
                    {batchReadiness.blockingReasons.length ? (
                      <ul className="mt-3 grid gap-2 text-sm leading-6 text-text-charcoal dark:text-white">
                        {batchReadiness.blockingReasons.map((reason) => (
                          <li key={reason.code} className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                            <div className="font-semibold">{reason.message}</div>
                            {typeof reason.count === 'number' ? (
                              <div className="mt-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                                Count: {formatCount(reason.count, language)}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-3 text-sm leading-6 text-emerald-700 dark:text-emerald-200">
                        No blocking reasons. This draft can publish.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.diagnosticsTitle}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm leading-6 text-text-charcoal dark:text-white">
                      <div>Skipped invalid reviews: {formatCount(batchReadiness.crawlDiagnostics.skippedInvalidCount, language)}</div>
                      {batchReadiness.crawlDiagnostics.topValidationIssues.length ? (
                        batchReadiness.crawlDiagnostics.topValidationIssues.map((issue) => (
                          <div key={issue.code} className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                            {issue.code} ({formatCount(issue.count, language)})
                          </div>
                        ))
                      ) : (
                        <div>No validation issues reported.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  )
}
