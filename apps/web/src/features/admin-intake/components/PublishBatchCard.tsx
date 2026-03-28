import type { ReviewIntakeBatch } from '../../../lib/api'
import type { AdminIntakeLabels } from '../adminIntakeLabels'
import { AdminCard, AdminDataCell, AdminButton } from '../../admin-shell/components/AdminPrimitives'

interface PublishBatchCardProps {
  batch: ReviewIntakeBatch
  labels: AdminIntakeLabels
  pending: boolean
  onPublish: () => Promise<void>
  onDelete?: () => Promise<void>
}

export function PublishBatchCard({
  batch,
  labels,
  pending,
  onPublish,
  onDelete,
}: PublishBatchCardProps) {
  const readyToPublish = batch.counts.approvedItems > 0

  return (
    <AdminCard
      title={labels.publishTitle}
      description={labels.publishDescription}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p
            data-testid="admin-intake-publish-status"
            className="text-[15px] font-semibold text-slate-900 dark:text-white"
          >
            {readyToPublish ? labels.publishReady : labels.publishBlocked}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <AdminButton
              variant="primary"
              disabled={pending || !readyToPublish}
              onClick={() => void onPublish()}
              dataTestId="admin-intake-publish-button"
            >
              {labels.publishAction}
            </AdminButton>
            {onDelete && !batch.publishedAt ? (
              <AdminButton
                variant="danger"
                disabled={pending}
                dataTestId="admin-intake-delete-batch-button"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this batch? This cannot be undone.')) {
                    void onDelete()
                  }
                }}
              >
                Delete Batch
              </AdminButton>
            ) : null}
            {batch.publishedAt ? (
              <div
                data-testid="admin-intake-publish-success"
                className="inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              >
                {labels.publishSuccess}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[420px]">
          <AdminDataCell label="Total" value={batch.counts.totalItems} />
          <AdminDataCell 
            label="Approved" 
            value={<span className="text-emerald-600 dark:text-emerald-400">{batch.counts.approvedItems}</span>} 
          />
          <AdminDataCell label="Pending" value={batch.counts.pendingItems} />
          <AdminDataCell 
            label="Rejected" 
            value={<span className="text-red-600 dark:text-red-400">{batch.counts.rejectedItems}</span>} 
          />
        </div>
      </div>
    </AdminCard>
  )
}
