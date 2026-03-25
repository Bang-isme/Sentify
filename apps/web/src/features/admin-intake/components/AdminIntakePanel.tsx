import { useCallback, useEffect, useState } from 'react'
import {
  ApiClientError,
  addReviewIntakeItems,
  createReviewIntakeBatch,
  getReviewIntakeBatch,
  listReviewIntakeBatches,
  publishReviewIntakeBatch,
  updateReviewIntakeItem,
  type CreateReviewIntakeItemInput,
  type RestaurantDetail,
  type ReviewIntakeBatch,
  type UpdateReviewIntakeItemInput,
} from '../../../lib/api'
import { getAdminIntakeLabels } from '../adminIntakeLabels'
import { PublishBatchCard } from './PublishBatchCard'
import { ReviewCurationTable } from './ReviewCurationTable'
import { ReviewEntryForm } from './ReviewEntryForm'

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

interface AdminIntakePanelProps {
  language: string
  restaurantId: string | null
  detail: RestaurantDetail | null
  onPublished: () => void
}

export function AdminIntakePanel({
  language,
  restaurantId,
  detail,
  onPublished,
}: AdminIntakePanelProps) {
  const isVietnamese = language.startsWith('vi')
  const labels = getAdminIntakeLabels(language)
  const creatableSourceTypes: ReviewIntakeBatch['sourceType'][] = ['MANUAL', 'BULK_PASTE', 'CSV']
  const batchTitleFieldId = 'admin-intake-batch-title'
  const batchSourceFieldId = 'admin-intake-batch-source'
  const [batches, setBatches] = useState<ReviewIntakeBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<ReviewIntakeBatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newBatchTitle, setNewBatchTitle] = useState('')
  const [newBatchSourceType, setNewBatchSourceType] =
    useState<ReviewIntakeBatch['sourceType']>('MANUAL')

  const loadBatches = useCallback(async (preferredBatchId?: string | null) => {
    if (!restaurantId) {
      setBatches([])
      setSelectedBatchId(null)
      setSelectedBatch(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextBatches = await listReviewIntakeBatches(restaurantId)
      setBatches(nextBatches)

      const nextBatchId =
        preferredBatchId && nextBatches.some((batch) => batch.id === preferredBatchId)
          ? preferredBatchId
          : nextBatches[0]?.id ?? null

      setSelectedBatchId(nextBatchId)

      if (nextBatchId) {
        const batchDetail = await getReviewIntakeBatch(nextBatchId)
        setSelectedBatch(batchDetail)
      } else {
        setSelectedBatch(null)
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  const loadBatchDetail = useCallback(async (batchId: string) => {
    setDetailLoading(true)
    setError(null)

    try {
      const batchDetail = await getReviewIntakeBatch(batchId)
      setSelectedBatch(batchDetail)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  useEffect(() => {
    if (!selectedBatchId) {
      return
    }

    void loadBatchDetail(selectedBatchId)
  }, [selectedBatchId, loadBatchDetail])

  async function handleCreateBatch() {
    if (!restaurantId) {
      return
    }

    setPending(true)
    setNotice(null)

    try {
      const createdBatch = await createReviewIntakeBatch({
        restaurantId,
        sourceType: newBatchSourceType,
        title: newBatchTitle.trim() || undefined,
      })

      setNewBatchTitle('')
      setNewBatchSourceType('MANUAL')
      setNotice(isVietnamese ? 'Đã tạo lô nhập liệu.' : 'Batch created.')
      await loadBatches(createdBatch.id)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setPending(false)
    }
  }

  async function handleAddItems(items: CreateReviewIntakeItemInput[]) {
    if (!selectedBatch) {
      return
    }

    setPending(true)
    setNotice(null)

    try {
      const updatedBatch = await addReviewIntakeItems(selectedBatch.id, items)
      setSelectedBatch(updatedBatch)
      setBatches((current) =>
        current.map((batch) => (batch.id === updatedBatch.id ? updatedBatch : batch)),
      )
      setNotice(
        isVietnamese
          ? `Đã thêm ${items.length} mục đánh giá.`
          : `${items.length} review item${items.length > 1 ? 's' : ''} added.`,
      )
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setPending(false)
    }
  }

  async function handleSaveItem(itemId: string, input: UpdateReviewIntakeItemInput) {
    setPending(true)
    setNotice(null)

    try {
      const updatedBatch = await updateReviewIntakeItem(itemId, input)
      setSelectedBatch(updatedBatch)
      setBatches((current) =>
        current.map((batch) => (batch.id === updatedBatch.id ? updatedBatch : batch)),
      )
      setNotice(isVietnamese ? 'Đã cập nhật mục đánh giá.' : 'Review item updated.')
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setPending(false)
    }
  }

  async function handlePublish() {
    if (!selectedBatch) {
      return
    }

    setPending(true)
    setNotice(null)

    try {
      const result = await publishReviewIntakeBatch(selectedBatch.id)
      setSelectedBatch(result.batch)
      setBatches((current) =>
        current.map((batch) => (batch.id === result.batch.id ? result.batch : batch)),
      )
      setNotice(labels.publishSuccess)
      onPublished()
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.2rem] border border-border-light/70 bg-surface-white/88 p-4 shadow-[0_18px_48px_-42px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-2 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
            <span className="material-symbols-outlined text-base text-primary">storefront</span>
            {detail?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-2 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
            <span className="material-symbols-outlined text-base text-primary">database</span>
            {(isVietnamese ? 'Chính sách nguồn: ' : 'Source policy: ') +
              (detail?.datasetStatus.sourcePolicy ?? 'UNCONFIGURED')}
          </span>
          {detail?.datasetStatus.lastPublishedAt ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-2 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
              <span className="material-symbols-outlined text-base text-primary">schedule</span>
              {isVietnamese
                ? `Công bố gần nhất: ${new Date(detail.datasetStatus.lastPublishedAt).toLocaleString(language)}`
                : `Last publish: ${new Date(detail.datasetStatus.lastPublishedAt).toLocaleString(language)}`}
            </span>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.3rem] border border-red-300/35 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/25 dark:bg-red-500/12 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-[1.3rem] border border-emerald-300/35 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}

      <section className="rounded-[1.55rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            {labels.createBatchTitle}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {labels.createBatchDescription}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_auto]">
          <label
            htmlFor={batchTitleFieldId}
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{labels.batchTitleLabel}</span>
            <input
              id={batchTitleFieldId}
              aria-label={labels.batchTitleLabel}
              value={newBatchTitle}
              onChange={(event) => setNewBatchTitle(event.target.value)}
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            />
          </label>
          <label
            htmlFor={batchSourceFieldId}
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{labels.batchSourceLabel}</span>
            <select
              id={batchSourceFieldId}
              aria-label={labels.batchSourceLabel}
              value={newBatchSourceType}
              onChange={(event) => setNewBatchSourceType(event.target.value as ReviewIntakeBatch['sourceType'])}
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            >
              {creatableSourceTypes.map((value) => (
                <option key={value} value={value}>
                  {labels.sourceTypes[value]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending || !restaurantId}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
              onClick={() => void handleCreateBatch()}
            >
              {labels.batchCreateAction}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[1.55rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
          <div className="mb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              {labels.inboxTitle}
            </div>
            <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
              {labels.inboxDescription}
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
              {isVietnamese ? 'Đang tải danh sách lô...' : 'Loading batches...'}
            </div>
          ) : batches.length === 0 ? (
            <div className="rounded-[1.3rem] border border-dashed border-border-light/80 bg-bg-light/60 p-4 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/45 dark:text-text-silver-dark">
              {labels.emptyBatches}
            </div>
          ) : (
            <div className="grid gap-3">
              {batches.map((batch) => {
                const isActive = selectedBatchId === batch.id

                return (
                  <button
                    key={batch.id}
                    type="button"
                    className={`rounded-[1.35rem] border p-4 text-left transition ${
                      isActive
                        ? 'border-primary/35 bg-primary/8'
                        : 'border-border-light/70 bg-bg-light/70 hover:border-primary/25 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
                    }`}
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                        {batch.title || labels.sourceTypes[batch.sourceType]}
                      </div>
                      <span className="rounded-full border border-border-light/70 bg-surface-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
                        {labels.statuses[batch.status]}
                      </span>
                    </div>
                    <div className="mt-3 text-xs leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {isVietnamese
                        ? `${batch.counts.totalItems} mục | ${batch.counts.approvedItems} đã duyệt | ${batch.counts.pendingItems} đang chờ`
                        : `${batch.counts.totalItems} items | ${batch.counts.approvedItems} approved | ${batch.counts.pendingItems} pending`}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="grid gap-6">
          {selectedBatch ? (
            <>
              <section className="rounded-[1.55rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    {labels.quickEntryTitle}
                  </div>
                  <span className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    {labels.sourceTypes[selectedBatch.sourceType]}
                  </span>
                  <span className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    {labels.statuses[selectedBatch.status]}
                  </span>
                </div>
                <p className="mb-5 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                  {labels.quickEntryDescription}
                </p>
                <ReviewEntryForm
                  labels={labels}
                  pending={pending}
                  onAddSingle={async (item) => handleAddItems([item])}
                  onAddBulk={handleAddItems}
                />
              </section>

              <section className="rounded-[1.55rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
                <div className="mb-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    {labels.reviewQueueTitle}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                    {labels.reviewQueueDescription}
                  </p>
                </div>
                {detailLoading ? (
                  <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Đang tải chi tiết lô...' : 'Loading batch detail...'}
                  </div>
                ) : (
                  <ReviewCurationTable
                    batch={selectedBatch}
                    labels={labels}
                    pending={pending}
                    onSaveItem={handleSaveItem}
                  />
                )}
              </section>

              <PublishBatchCard
                batch={selectedBatch}
                labels={labels}
                pending={pending}
                onPublish={handlePublish}
              />
            </>
          ) : (
            <section className="rounded-[1.55rem] border border-dashed border-border-light/80 bg-bg-light/60 p-6 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/45 dark:text-text-silver-dark">
              {labels.emptyBatches}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
