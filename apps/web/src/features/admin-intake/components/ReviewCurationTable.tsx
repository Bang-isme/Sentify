import { useState } from 'react'
import type { ReviewIntakeBatch, ReviewIntakeItem, UpdateReviewIntakeItemInput } from '../../../lib/api'
import type { AdminIntakeLabels } from '../adminIntakeLabels'

interface ReviewCurationTableProps {
  batch: ReviewIntakeBatch
  labels: AdminIntakeLabels
  pending: boolean
  onSaveItem: (itemId: string, input: UpdateReviewIntakeItemInput) => Promise<void>
}

function EditableRow({
  item,
  labels,
  pending,
  onSaveItem,
}: {
  item: ReviewIntakeItem
  labels: AdminIntakeLabels
  pending: boolean
  onSaveItem: (itemId: string, input: UpdateReviewIntakeItemInput) => Promise<void>
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

  return (
    <div className="rounded-[1.35rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-border-light/70 bg-surface-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
          {labels.approvalStatuses[approvalStatus]}
        </span>
        {item.canonicalReviewId ? (
          <span className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200">
            Published
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="grid gap-3">
          <label
            htmlFor={`${fieldIdBase}-author`}
            className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-silver-light dark:text-text-silver-dark"
          >
            <span>{labels.authorLabel}</span>
            <input
              id={`${fieldIdBase}-author`}
              aria-label={labels.authorLabel}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              className="h-10 rounded-2xl border border-border-light bg-surface-white px-3 text-sm font-medium text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              htmlFor={`${fieldIdBase}-rating`}
              className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-silver-light dark:text-text-silver-dark"
            >
              <span>{labels.ratingLabel}</span>
              <select
                id={`${fieldIdBase}-rating`}
                aria-label={labels.ratingLabel}
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="h-10 rounded-2xl border border-border-light bg-surface-white px-3 text-sm font-medium text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor={`${fieldIdBase}-date`}
              className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-silver-light dark:text-text-silver-dark"
            >
              <span>{labels.dateLabel}</span>
              <input
                id={`${fieldIdBase}-date`}
                aria-label={labels.dateLabel}
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
                className="h-10 rounded-2xl border border-border-light bg-surface-white px-3 text-sm font-medium text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
              />
            </label>
          </div>
          <label
            htmlFor={`${fieldIdBase}-decision`}
            className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-silver-light dark:text-text-silver-dark"
          >
            <span>Decision</span>
            <select
              id={`${fieldIdBase}-decision`}
              aria-label="Decision"
              value={approvalStatus}
              onChange={(event) => setApprovalStatus(event.target.value as ReviewIntakeItem['approvalStatus'])}
              className="h-10 rounded-2xl border border-border-light bg-surface-white px-3 text-sm font-medium text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
            >
              <option value="PENDING">{labels.approvalStatuses.PENDING}</option>
              <option value="APPROVED">{labels.approvalStatuses.APPROVED}</option>
              <option value="REJECTED">{labels.approvalStatuses.REJECTED}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3">
          <label
            htmlFor={`${fieldIdBase}-content`}
            className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-silver-light dark:text-text-silver-dark"
          >
            <span>{labels.contentLabel}</span>
            <textarea
              id={`${fieldIdBase}-content`}
              aria-label={labels.contentLabel}
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="rounded-3xl border border-border-light bg-surface-white px-4 py-3 text-sm font-medium text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
            />
          </label>
          <label
            htmlFor={`${fieldIdBase}-note`}
            className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-silver-light dark:text-text-silver-dark"
          >
            <span>Reviewer note</span>
            <textarea
              id={`${fieldIdBase}-note`}
              aria-label="Reviewer note"
              rows={3}
              value={reviewerNote}
              onChange={(event) => setReviewerNote(event.target.value)}
              className="rounded-3xl border border-border-light bg-surface-white px-4 py-3 text-sm font-medium text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 dark:text-bg-dark"
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
            </button>
            <button
              type="button"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border-light/70 bg-surface-white px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-surface-dark dark:text-white"
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
            </button>
            <button
              type="button"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full border border-red-300/35 bg-red-500/8 px-4 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200"
              onClick={() =>
                void onSaveItem(item.id, {
                  approvalStatus: 'REJECTED',
                  reviewerNote: reviewerNote.trim() || 'Rejected during review',
                })
              }
            >
              Reject
            </button>
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
}: ReviewCurationTableProps) {
  if (!batch.items?.length) {
    return (
      <div className="rounded-[1.3rem] border border-dashed border-border-light/80 bg-bg-light/60 p-4 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/45 dark:text-text-silver-dark">
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
        />
      ))}
    </div>
  )
}
