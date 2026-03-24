import { useState, type FormEvent } from 'react'
import type { CreateReviewIntakeItemInput } from '../../../lib/api'
import type { AdminIntakeLabels } from '../adminIntakeLabels'

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="rounded-[1.4rem] border border-border-light/70 bg-bg-light/70 p-5 dark:border-border-dark dark:bg-bg-dark/55"
        onSubmit={handleSingleSubmit}
      >
        <div className="grid gap-4">
          <label
            htmlFor={authorFieldId}
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{labels.authorLabel}</span>
            <input
              id={authorFieldId}
              aria-label={labels.authorLabel}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label
              htmlFor={ratingFieldId}
              className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
            >
              <span>{labels.ratingLabel}</span>
              <select
                id={ratingFieldId}
                aria-label={labels.ratingLabel}
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
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
              className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
            >
              <span>{labels.dateLabel}</span>
              <input
                id={dateFieldId}
                aria-label={labels.dateLabel}
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
                className="h-11 rounded-2xl border border-border-light bg-surface-white px-4 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              />
            </label>
          </div>

          <label
            htmlFor={contentFieldId}
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{labels.contentLabel}</span>
            <textarea
              id={contentFieldId}
              aria-label={labels.contentLabel}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              className="rounded-3xl border border-border-light bg-surface-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 dark:text-bg-dark"
          >
            {labels.addSingleAction}
          </button>
        </div>
      </form>

      <form
        className="rounded-[1.4rem] border border-border-light/70 bg-bg-light/70 p-5 dark:border-border-dark dark:bg-bg-dark/55"
        onSubmit={handleBulkSubmit}
      >
        <div className="grid gap-4">
          <label
            htmlFor={bulkFieldId}
            className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
          >
            <span>{labels.bulkPasteLabel}</span>
            <textarea
              id={bulkFieldId}
              aria-label={labels.bulkPasteLabel}
              value={bulkPaste}
              onChange={(event) => setBulkPaste(event.target.value)}
              rows={10}
              placeholder={labels.bulkPasteHint}
              aria-describedby={bulkHintId}
              className="rounded-3xl border border-border-light bg-surface-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            />
          </label>
          <p
            id={bulkHintId}
            className="text-xs leading-6 text-text-silver-light dark:text-text-silver-dark"
          >
            {labels.bulkPasteHint}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-full border border-primary/35 bg-primary/8 px-5 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {labels.addBulkAction}
          </button>
        </div>
      </form>
    </div>
  )
}
