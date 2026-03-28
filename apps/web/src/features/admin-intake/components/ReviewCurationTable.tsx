import { useState } from 'react'
import type { ReviewIntakeBatch, ReviewIntakeItem, UpdateReviewIntakeItemInput } from '../../../lib/api'
import type { AdminIntakeLabels } from '../adminIntakeLabels'
import { AdminBadge, AdminButton } from '../../admin-shell/components/AdminPrimitives'

interface ReviewCurationTableProps {
  batch: ReviewIntakeBatch
  labels: AdminIntakeLabels
  pending: boolean
  onSaveItem: (itemId: string, input: UpdateReviewIntakeItemInput) => Promise<void>
  onDeleteItem?: (itemId: string) => Promise<void>
}

function EditableRow({
  item,
  labels,
  pending,
  onSaveItem,
  onDeleteItem,
}: {
  item: ReviewIntakeItem
  labels: AdminIntakeLabels
  pending: boolean
  onSaveItem: (itemId: string, input: UpdateReviewIntakeItemInput) => Promise<void>
  onDeleteItem?: (itemId: string) => Promise<void>
}) {
  const fieldIdBase = `review-intake-item-${item.id}`
  const [authorName, setAuthorName] = useState(item.normalizedAuthorName ?? item.rawAuthorName ?? '')
  const [rating, setRating] = useState(String(item.normalizedRating ?? item.rawRating ?? 5))
  const [reviewDate, setReviewDate] = useState(
    (item.normalizedReviewDate ?? item.rawReviewDate ?? '')?.slice(0, 10),
  )
  const [content, setContent] = useState(item.normalizedContent ?? item.rawContent ?? '')
  const [reviewerNote, setReviewerNote] = useState(item.reviewerNote ?? '')
  const [approvalStatus, setApprovalStatus] = useState(item.approvalStatus)

  const getToneForStatus = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'success'
      case 'REJECTED': return 'danger'
      default: return 'warning'
    }
  }

  return (
    <div
      data-testid={`admin-intake-item-${item.id}`}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#18181b]"
    >
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
        <AdminBadge 
          label={labels.approvalStatuses[approvalStatus]} 
          tone={getToneForStatus(approvalStatus)} 
        />
        {item.canonicalReviewId ? (
          <AdminBadge label="Published" tone="success" />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid gap-4">
          <label htmlFor={`${fieldIdBase}-author`} className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{labels.authorLabel}</span>
            <input
              id={`${fieldIdBase}-author`}
              data-testid={`admin-intake-item-author-${item.id}`}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor={`${fieldIdBase}-rating`} className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <span>{labels.ratingLabel}</span>
              <select
                id={`${fieldIdBase}-rating`}
                data-testid={`admin-intake-item-rating-${item.id}`}
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label htmlFor={`${fieldIdBase}-date`} className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <span>{labels.dateLabel}</span>
              <input
                id={`${fieldIdBase}-date`}
                data-testid={`admin-intake-item-date-${item.id}`}
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
              />
            </label>
          </div>
          <label htmlFor={`${fieldIdBase}-decision`} className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>Decision</span>
            <select
              id={`${fieldIdBase}-decision`}
              data-testid={`admin-intake-item-decision-${item.id}`}
              value={approvalStatus}
              onChange={(event) => setApprovalStatus(event.target.value as ReviewIntakeItem['approvalStatus'])}
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            >
              <option value="PENDING">{labels.approvalStatuses.PENDING}</option>
              <option value="APPROVED">{labels.approvalStatuses.APPROVED}</option>
              <option value="REJECTED">{labels.approvalStatuses.REJECTED}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4">
          <label htmlFor={`${fieldIdBase}-content`} className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{labels.contentLabel}</span>
            <textarea
              id={`${fieldIdBase}-content`}
              data-testid={`admin-intake-item-content-${item.id}`}
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            />
          </label>
          <label htmlFor={`${fieldIdBase}-note`} className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>Reviewer note</span>
            <textarea
              id={`${fieldIdBase}-note`}
              data-testid={`admin-intake-item-note-${item.id}`}
              rows={2}
              value={reviewerNote}
              onChange={(event) => setReviewerNote(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            />
          </label>
          
          <div className="mt-2 flex flex-wrap gap-3">
            <AdminButton
              variant="primary"
              disabled={pending}
              dataTestId={`admin-intake-item-save-${item.id}`}
              onClick={() =>
                void onSaveItem(item.id, {
                  normalizedAuthorName: authorName.trim() || null,
                  normalizedRating: Number.parseInt(rating, 10),
                  normalizedReviewDate: reviewDate || null,
                  normalizedContent: content.trim() || null,
                  reviewerNote: reviewerNote.trim() || null,
                  approvalStatus,
                })
              }
            >
              Save review item
            </AdminButton>
            <AdminButton
              variant="secondary"
              disabled={pending}
              dataTestId={`admin-intake-item-approve-${item.id}`}
              onClick={() =>
                void onSaveItem(item.id, {
                  approvalStatus: 'APPROVED',
                  normalizedAuthorName: authorName.trim() || null,
                  normalizedRating: Number.parseInt(rating, 10),
                  normalizedReviewDate: reviewDate || null,
                  normalizedContent: content.trim() || null,
                })
              }
            >
              Approve
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={pending}
              dataTestId={`admin-intake-item-reject-${item.id}`}
              onClick={() =>
                void onSaveItem(item.id, {
                  approvalStatus: 'REJECTED',
                  reviewerNote: reviewerNote.trim() || 'Rejected during review',
                })
              }
            >
              Reject
            </AdminButton>
            {onDeleteItem ? (
              <AdminButton
                variant="ghost"
                disabled={pending}
                dataTestId={`admin-intake-item-delete-${item.id}`}
                onClick={() => {
                  if (confirm('Are you sure you want to permanently delete this item?')) {
                    void onDeleteItem(item.id)
                  }
                }}
              >
                Delete
              </AdminButton>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReviewCurationTable({
  batch,
  labels,
  pending,
  onSaveItem,
  onDeleteItem,
}: ReviewCurationTableProps) {
  if (!batch.items?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
        {labels.emptyBatches}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {batch.items.map((item) => (
        <EditableRow
          key={item.id}
          item={item}
          labels={labels}
          pending={pending}
          onSaveItem={onSaveItem}
          onDeleteItem={onDeleteItem}
        />
      ))}
    </div>
  )
}
