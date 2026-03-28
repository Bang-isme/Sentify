import { useState, type FormEvent } from 'react'
import type { CreateReviewIntakeItemInput } from '../../../lib/api'
import type { AdminIntakeLabels } from '../adminIntakeLabels'
import { AdminCard, AdminButton } from '../../admin-shell/components/AdminPrimitives'

interface ReviewEntryFormProps {
  labels: AdminIntakeLabels
  pending: boolean
  onAddSingle: (item: CreateReviewIntakeItemInput) => Promise<void>
  onAddBulk: (items: CreateReviewIntakeItemInput[]) => Promise<void>
}

function parseBulkLine(line: string): CreateReviewIntakeItemInput | null {
  const trimmedLine = line.trim()

  if (!trimmedLine) {
    return null
  }

  const parts = trimmedLine.split('|').map((part) => part.trim())
  const rating = Number.parseInt(parts[0] ?? '', 10)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(`Invalid rating in line: ${trimmedLine}`)
  }

  if (parts.length === 2) {
    return {
      rawRating: rating,
      rawContent: parts[1] || null,
    }
  }

  if (parts.length === 3) {
    return {
      rawRating: rating,
      rawAuthorName: parts[1] || undefined,
      rawContent: parts[2] || null,
    }
  }

  return {
    rawRating: rating,
    rawAuthorName: parts[1] || undefined,
    rawReviewDate: parts[2] || null,
    rawContent: parts.slice(3).join(' | ') || null,
  }
}

export function ReviewEntryForm({
  labels,
  pending,
  onAddSingle,
  onAddBulk,
}: ReviewEntryFormProps) {
  const authorFieldId = 'review-entry-author'
  const ratingFieldId = 'review-entry-rating'
  const dateFieldId = 'review-entry-date'
  const contentFieldId = 'review-entry-content'
  const bulkFieldId = 'review-entry-bulk'
  const bulkHintId = 'review-entry-bulk-hint'
  const [authorName, setAuthorName] = useState('')
  const [rating, setRating] = useState('5')
  const [reviewDate, setReviewDate] = useState('')
  const [content, setContent] = useState('')
  const [bulkPaste, setBulkPaste] = useState('')

  async function handleSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await onAddSingle({
      rawAuthorName: authorName.trim() || undefined,
      rawRating: Number.parseInt(rating, 10),
      rawReviewDate: reviewDate || null,
      rawContent: content.trim() || null,
    })

    setAuthorName('')
    setRating('5')
    setReviewDate('')
    setContent('')
  }

  async function handleBulkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const items = bulkPaste
      .split(/\r?\n/)
      .map(parseBulkLine)
      .filter((item): item is CreateReviewIntakeItemInput => Boolean(item))

    if (items.length === 0) {
      return
    }

    await onAddBulk(items)
    setBulkPaste('')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AdminCard className="bg-slate-50 dark:bg-white/5">
        <form onSubmit={handleSingleSubmit} className="grid gap-4">
          <label
            htmlFor={authorFieldId}
            className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300"
          >
            <span>{labels.authorLabel}</span>
            <input
              id={authorFieldId}
              data-testid="admin-intake-single-author-input"
              aria-label={labels.authorLabel}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor={ratingFieldId}
              className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300"
            >
              <span>{labels.ratingLabel}</span>
              <select
                id={ratingFieldId}
                data-testid="admin-intake-single-rating-select"
                aria-label={labels.ratingLabel}
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label
              htmlFor={dateFieldId}
              className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300"
            >
              <span>{labels.dateLabel}</span>
              <input
                id={dateFieldId}
                data-testid="admin-intake-single-date-input"
                aria-label={labels.dateLabel}
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
              />
            </label>
          </div>

          <label
            htmlFor={contentFieldId}
            className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300"
          >
            <span>{labels.contentLabel}</span>
            <textarea
              id={contentFieldId}
              data-testid="admin-intake-single-content-input"
              aria-label={labels.contentLabel}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white"
            />
          </label>

          <AdminButton
            type="submit"
            disabled={pending}
            variant="primary"
            dataTestId="admin-intake-add-single-button"
          >
            {labels.addSingleAction}
          </AdminButton>
        </form>
      </AdminCard>

      <AdminCard className="bg-slate-50 dark:bg-white/5">
        <form onSubmit={handleBulkSubmit} className="grid gap-4">
          <label
            htmlFor={bulkFieldId}
            className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300"
          >
            <span>{labels.bulkPasteLabel}</span>
            <textarea
              id={bulkFieldId}
              data-testid="admin-intake-bulk-input"
              aria-label={labels.bulkPasteLabel}
              value={bulkPaste}
              onChange={(event) => setBulkPaste(event.target.value)}
              rows={10}
              placeholder={labels.bulkPasteHint}
              aria-describedby={bulkHintId}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#18181b] dark:text-white font-mono"
            />
          </label>
          <p
            id={bulkHintId}
            className="text-[13px] leading-relaxed text-slate-500 dark:text-zinc-400"
          >
            {labels.bulkPasteHint}
          </p>
          <AdminButton
            type="submit"
            disabled={pending}
            variant="secondary"
            dataTestId="admin-intake-add-bulk-button"
          >
            {labels.addBulkAction}
          </AdminButton>
        </form>
      </AdminCard>
    </div>
  )
}
