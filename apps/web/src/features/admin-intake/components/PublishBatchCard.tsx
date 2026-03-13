import type { ReviewIntakeBatch } from '../../../lib/api'
import type { AdminIntakeLabels } from '../adminIntakeLabels'

interface PublishBatchCardProps {
  batch: ReviewIntakeBatch
  labels: AdminIntakeLabels
  pending: boolean
  onPublish: () => Promise<void>
}

export function PublishBatchCard({
  batch,
  labels,
  pending,
  onPublish,
}: PublishBatchCardProps) {
  const readyToPublish = batch.counts.approvedItems > 0

  return (
    <section className="rounded-[1.55rem] border border-border-light/70 bg-surface-white/88 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            {labels.publishTitle}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {labels.publishDescription}
          </p>
          <p className="mt-3 text-sm font-semibold text-text-charcoal dark:text-white">
            {readyToPublish ? labels.publishReady : labels.publishBlocked}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[420px]">
          <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              Total
            </div>
            <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
              {batch.counts.totalItems}
            </div>
          </div>
          <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              Approved
            </div>
            <div className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">
              {batch.counts.approvedItems}
            </div>
          </div>
          <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              Pending
            </div>
            <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
              {batch.counts.pendingItems}
            </div>
          </div>
          <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              Rejected
            </div>
            <div className="mt-1 text-lg font-black text-red-600 dark:text-red-300">
              {batch.counts.rejectedItems}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !readyToPublish}
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
          onClick={() => void onPublish()}
        >
          {labels.publishAction}
        </button>
        {batch.publishedAt ? (
          <div className="inline-flex h-11 items-center rounded-full border border-emerald-300/35 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200">
            {labels.publishSuccess}
          </div>
        ) : null}
      </div>
    </section>
  )
}
