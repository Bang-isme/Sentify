import { useCallback, useEffect, useState } from 'react'
import {
  ApiClientError,
  addReviewIntakeItems,
  createReviewIntakeBatch,
  getReviewIntakeBatch,
  listReviewIntakeBatches,
  publishReviewIntakeBatch,
  updateReviewIntakeItem,
  deleteReviewIntakeBatch,
  deleteReviewIntakeItem,
  type CreateReviewIntakeItemInput,
  type RestaurantDetail,
  type ReviewIntakeBatch,
  type UpdateReviewIntakeItemInput,
} from '../../../lib/api'
import { getAdminIntakeLabels } from '../adminIntakeLabels'
import { PublishBatchCard } from './PublishBatchCard'
import { ReviewCurationTable } from './ReviewCurationTable'
import { ReviewEntryForm } from './ReviewEntryForm'
import { AdminCard, AdminBadge, AdminButton, AdminStatusMessage } from '../../admin-shell/components/AdminPrimitives'

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
    if (!restaurantId) return
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
    if (!selectedBatch) return
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

  async function handleDeleteItem(itemId: string) {
    setPending(true)
    setNotice(null)
    try {
      await deleteReviewIntakeItem(itemId)
      setNotice(isVietnamese ? 'Đã xóa mục đánh giá.' : 'Review item deleted.')
      if (selectedBatchId) {
        await loadBatchDetail(selectedBatchId)
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setPending(false)
    }
  }

  async function handleDeleteBatch() {
    if (!selectedBatchId) return
    setPending(true)
    setNotice(null)
    try {
      await deleteReviewIntakeBatch(selectedBatchId)
      setNotice(isVietnamese ? 'Đã xóa lô nhập liệu.' : 'Batch deleted.')
      await loadBatches()
      onPublished() // Trigger a re-render of global stats
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setPending(false)
    }
  }

  async function handlePublish() {
    if (!selectedBatch) return
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
    <div className="grid gap-4">
      <AdminCard>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-zinc-300">
            <span className="material-symbols-outlined text-base">storefront</span>
            {detail?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-zinc-300">
            <span className="material-symbols-outlined text-base">database</span>
            {(isVietnamese ? 'Chính sách nguồn: ' : 'Source policy: ') +
              (detail?.datasetStatus.sourcePolicy ?? 'UNCONFIGURED')}
          </div>
          {detail?.datasetStatus.lastPublishedAt ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-zinc-300">
              <span className="material-symbols-outlined text-base">schedule</span>
              {isVietnamese
                ? `Công bố gần nhất: ${new Date(detail.datasetStatus.lastPublishedAt).toLocaleString(language)}`
                : `Last publish: ${new Date(detail.datasetStatus.lastPublishedAt).toLocaleString(language)}`}
            </div>
          ) : null}
        </div>
      </AdminCard>

      {error ? <AdminStatusMessage tone="error">{error}</AdminStatusMessage> : null}
      {notice ? <AdminStatusMessage tone="success">{notice}</AdminStatusMessage> : null}

      <AdminCard title={labels.createBatchTitle} description={labels.createBatchDescription}>
        <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr_auto] items-end">
          <label htmlFor={batchTitleFieldId} className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
            <span>{labels.batchTitleLabel}</span>
            <input
              id={batchTitleFieldId}
              data-testid="admin-intake-batch-title-input"
              value={newBatchTitle}
              onChange={(event) => setNewBatchTitle(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b]"
            />
          </label>
          <label htmlFor={batchSourceFieldId} className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
            <span>{labels.batchSourceLabel}</span>
            <select
              id={batchSourceFieldId}
              data-testid="admin-intake-batch-source-select"
              value={newBatchSourceType}
              onChange={(event) => setNewBatchSourceType(event.target.value as ReviewIntakeBatch['sourceType'])}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b]"
            >
              {creatableSourceTypes.map((value) => (
                <option key={value} value={value}>
                  {labels.sourceTypes[value]}
                </option>
              ))}
            </select>
          </label>
          <AdminButton
            variant="primary"
            disabled={pending || !restaurantId}
            onClick={() => void handleCreateBatch()}
            dataTestId="admin-intake-create-batch-button"
          >
            {labels.batchCreateAction}
          </AdminButton>
        </div>
      </AdminCard>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr] items-start">
        <AdminCard title={labels.inboxTitle} description={labels.inboxDescription} className="h-full">
          {loading ? (
            <div className="text-sm text-slate-500 dark:text-zinc-400">
              {isVietnamese ? 'Đang tải danh sách lô...' : 'Loading batches...'}
            </div>
          ) : batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {labels.emptyBatches}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {batches.map((batch) => {
                const isActive = selectedBatchId === batch.id
                return (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    data-testid={`admin-intake-batch-select-${batch.id}`}
                    className={`flex flex-col gap-2 p-3 text-left rounded-xl border transition-all ${
                      isActive
                        ? 'border-indigo-500/30 bg-indigo-50/50 dark:border-white/20 dark:bg-white/10 ring-1 ring-indigo-500/20 dark:ring-white/10'
                        : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/5 dark:bg-transparent dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white break-words">
                          {batch.title || labels.sourceTypes[batch.sourceType]}
                        </div>
                      </div>
                      <AdminBadge label={labels.statuses[batch.status]} tone={batch.status === 'PUBLISHED' ? 'success' : 'neutral'} />
                    </div>
                    <div className="text-[12px] font-medium text-slate-500 dark:text-zinc-400">
                      {isVietnamese
                        ? `${batch.counts.totalItems} mục | ${batch.counts.approvedItems} đã duyệt | ${batch.counts.pendingItems} đang chờ`
                        : `${batch.counts.totalItems} items | ${batch.counts.approvedItems} approved | ${batch.counts.pendingItems} pending`}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </AdminCard>

        {selectedBatch ? (
          <div className="grid gap-4">
            <AdminCard>
              <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                <div className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {labels.quickEntryTitle}
                </div>
                <AdminBadge label={labels.sourceTypes[selectedBatch.sourceType]} />
                <AdminBadge label={labels.statuses[selectedBatch.status]} tone={selectedBatch.status === 'PUBLISHED' ? 'success' : 'neutral'} />
              </div>
              <p className="mb-5 text-[13px] leading-relaxed text-slate-500 dark:text-zinc-400">
                {labels.quickEntryDescription}
              </p>
              <ReviewEntryForm
                labels={labels}
                pending={pending}
                onAddSingle={async (item) => handleAddItems([item])}
                onAddBulk={handleAddItems}
              />
            </AdminCard>

            <AdminCard title={labels.reviewQueueTitle} description={labels.reviewQueueDescription}>
              {detailLoading ? (
                <div className="text-sm text-slate-500 dark:text-zinc-400">
                  {isVietnamese ? 'Đang tải chi tiết lô...' : 'Loading batch detail...'}
                </div>
              ) : (
                <ReviewCurationTable
                  batch={selectedBatch}
                  labels={labels}
                  pending={pending}
                  onSaveItem={handleSaveItem}
                  onDeleteItem={handleDeleteItem}
                />
              )}
            </AdminCard>

            <PublishBatchCard
              batch={selectedBatch}
              labels={labels}
              pending={pending}
              onPublish={handlePublish}
              onDelete={handleDeleteBatch}
            />
          </div>
        ) : (
          <AdminCard className="h-full flex items-center justify-center min-h-[400px]">
            <div className="text-sm text-slate-500 dark:text-zinc-400">
              {labels.emptyBatches}
            </div>
          </AdminCard>
        )}
      </div>
    </div>
  )
}
