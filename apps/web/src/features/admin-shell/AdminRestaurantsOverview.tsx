import { PageIntro, SectionCard, StatusMessage } from '../../components/product/workspace/shared'
import type { ProductUiCopy } from '../../content/productUiCopy'
import type { AppRoute } from '../app-shell/routes'
import type { AdminOpsLabels } from '../admin-ops/adminOpsLabels'
import type { AdminRestaurantDetail, AdminRestaurantSummary } from '../../lib/api'

interface AdminRestaurantsOverviewProps {
  language: string
  copy: ProductUiCopy['app']
  labels: AdminOpsLabels
  restaurants: AdminRestaurantSummary[]
  currentRestaurant: AdminRestaurantSummary | null
  detail: AdminRestaurantDetail | null
  loading: boolean
  error: string | null
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: AppRoute) => void
}

function formatNumber(value: number | null | undefined, language: string) {
  return new Intl.NumberFormat(language).format(value ?? 0)
}

function formatDateTime(value: string | null | undefined, language: string) {
  if (!value) {
    return 'N/A'
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminRestaurantsOverview({
  language,
  copy,
  labels,
  restaurants,
  currentRestaurant,
  detail,
  loading,
  error,
  onSelectRestaurant,
  onNavigate,
}: AdminRestaurantsOverviewProps) {
  const sourceStatus = detail?.userFlow.datasetStatus.sourcePolicy ?? 'UNCONFIGURED'
  const nextActions = detail?.adminFlow.nextActions ?? []

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={labels.navOverview}
        title={labels.overviewTitle}
        description={labels.overviewDescription}
        meta={[
          {
            icon: 'storefront',
            label: `${formatNumber(restaurants.length, language)} restaurant(s)`,
          },
          {
            icon: currentRestaurant?.googleMapUrl ? 'task_alt' : 'warning',
            label: currentRestaurant?.googleMapUrl ? 'Google Maps source configured' : 'Google Maps source missing',
            tone: currentRestaurant?.googleMapUrl ? 'success' : 'warning',
          },
          {
            icon: 'inventory_2',
            label: `${formatNumber(detail?.userFlow.datasetStatus.pendingBatchCount, language)} pending batch(es)`,
          },
        ]}
      />

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard title="Restaurant directory" description="Select a restaurant to inspect its admin-owned snapshot.">
          <div className="grid gap-3">
            {restaurants.map((restaurant) => {
              const isActive = restaurant.id === currentRestaurant?.id

              return (
                <button
                  key={restaurant.id}
                  type="button"
                  className={`rounded-[1.35rem] border p-4 text-left transition ${
                    isActive
                      ? 'border-primary/35 bg-primary/8'
                      : 'border-border-light/70 bg-bg-light/70 hover:border-primary/25 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
                  }`}
                  onClick={() => onSelectRestaurant(restaurant.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {restaurant.name}
                    </div>
                    <span className="rounded-full border border-border-light/70 bg-surface-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
                      {formatNumber(restaurant.totalReviews, language)} reviews
                    </span>
                  </div>
                  <div className="mt-2 text-xs leading-6 text-text-silver-light dark:text-text-silver-dark">
                    {restaurant.address ?? 'No address'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1 text-[11px] font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                      {formatNumber(restaurant.memberCount, language)} member(s)
                    </span>
                    <span className="rounded-full border border-border-light/70 bg-bg-light/70 px-3 py-1 text-[11px] font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                      {formatNumber(restaurant.pendingBatchCount, language)} pending batch(es)
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        <div className="grid gap-6">
          <SectionCard title={labels.overviewTitle} description={labels.overviewDescription}>
            {!currentRestaurant ? (
              <StatusMessage>No restaurant overview is available yet.</StatusMessage>
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Restaurant
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {currentRestaurant.name}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Source policy
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {sourceStatus}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Pending batches
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {formatNumber(detail?.userFlow.datasetStatus.pendingBatchCount, language)}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Last publish
                    </div>
                    <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                      {formatDateTime(detail?.userFlow.datasetStatus.lastPublishedAt, language)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark dark:text-bg-dark"
                    onClick={() => onNavigate('/admin/operations/intake')}
                  >
                    {labels.navIntake}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary dark:border-border-dark dark:text-white"
                    onClick={() => onNavigate('/admin/operations/review-ops')}
                  >
                    {labels.navReviewOps}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-border-light px-5 text-sm font-semibold text-text-charcoal transition hover:border-primary/35 hover:text-primary dark:border-border-dark dark:text-white"
                    onClick={() => onNavigate('/admin/operations/crawl')}
                  >
                    {labels.navReviewCrawl}
                  </button>
                </div>

                {nextActions.length ? (
                  <div className="rounded-[1.3rem] border border-border-light/70 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/55">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      Next actions
                    </div>
                    <ul className="mt-3 grid gap-2 text-sm leading-6 text-text-charcoal dark:text-white">
                      {nextActions.map((action) => (
                        <li key={action} className="rounded-2xl border border-border-light/70 bg-surface-white/80 px-4 py-3 dark:border-border-dark dark:bg-surface-dark/70">
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
