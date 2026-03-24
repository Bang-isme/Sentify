import type { RestaurantDetail } from '../../../lib/api'

function formatDateTime(value: string | null, language: string) {
  if (!value) {
    return 'N/A'
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getLabels(language: string) {
  if (language.startsWith('vi')) {
    return {
      title: 'Trạng thái dataset',
      description:
        'Merchant nên hiểu dữ liệu hiện đang được curate theo chính sách nào và lần publish gần nhất là khi nào.',
      policy: 'Chính sách dữ liệu',
      lastPublished: 'Lần publish gần nhất',
      openReview: 'Batch đang mở',
      pendingReview: 'Item chờ duyệt',
      openAdmin: 'Mở khu admin',
      policies: {
        ADMIN_CURATED: 'Admin curate',
        UNCONFIGURED: 'Chưa cấu hình',
      },
    }
  }

  if (language.startsWith('ja')) {
    return {
      title: 'データセット状態',
      description:
        '店舗側には、どのポリシーでデータが整備され、最後にいつ公開されたかだけを明確に見せます。',
      policy: 'データポリシー',
      lastPublished: '最終公開',
      openReview: '進行中バッチ',
      pendingReview: '保留中項目',
      openAdmin: '管理画面を開く',
      policies: {
        ADMIN_CURATED: '管理者キュレーション',
        UNCONFIGURED: '未設定',
      },
    }
  }

  return {
    title: 'Dataset status',
    description:
      'Merchant-facing UI should explain which dataset policy is active and when reviewed data was last published.',
    policy: 'Dataset policy',
    lastPublished: 'Last publish',
    openReview: 'Open batches',
    pendingReview: 'Pending items',
    openAdmin: 'Open admin intake',
    policies: {
      ADMIN_CURATED: 'Admin curated',
      UNCONFIGURED: 'Unconfigured',
    },
  }
}

interface DatasetStatusCardProps {
  detail: RestaurantDetail | null
  totalReviews: number
  language: string
  onOpenAdmin: () => void
}

export function DatasetStatusCard({
  detail,
  totalReviews,
  language,
  onOpenAdmin,
}: DatasetStatusCardProps) {
  const labels = getLabels(language)
  const datasetStatus = detail?.datasetStatus

  return (
    <section className="rounded-[1.75rem] border border-primary/18 bg-primary/[0.04] p-5 shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur dark:border-primary/15 dark:bg-primary/[0.05] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            {labels.title}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {labels.description}
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-full border border-primary/35 bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark dark:text-bg-dark"
          onClick={onOpenAdmin}
        >
          {labels.openAdmin}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
            {labels.policy}
          </div>
          <div className="mt-1 text-sm font-semibold text-text-charcoal dark:text-white">
            {datasetStatus ? labels.policies[datasetStatus.sourcePolicy] : labels.policies.UNCONFIGURED}
          </div>
        </div>
        <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
            {labels.lastPublished}
          </div>
          <div className="mt-1 text-sm font-semibold text-text-charcoal dark:text-white">
            {formatDateTime(datasetStatus?.lastPublishedAt ?? null, language)}
          </div>
        </div>
        <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
            {labels.openReview}
          </div>
          <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
            {datasetStatus?.pendingBatchCount ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
            {labels.pendingReview}
          </div>
          <div className="mt-1 text-lg font-black text-text-charcoal dark:text-white">
            {datasetStatus?.pendingItemCount ?? 0} / {totalReviews}
          </div>
        </div>
      </div>
    </section>
  )
}
