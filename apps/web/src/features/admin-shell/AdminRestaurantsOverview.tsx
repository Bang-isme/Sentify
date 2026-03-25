import { SectionCard, StatusMessage } from '../../components/product/workspace/shared'
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
    return language.startsWith('vi') ? 'Chưa có' : 'Not available'
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
  const isVietnamese = language.startsWith('vi')
  const nextActions = detail?.adminFlow.nextActions ?? []
  const sourceStatus = detail?.userFlow.datasetStatus.sourcePolicy ?? 'UNCONFIGURED'

  return (
    <div data-testid="admin-overview" className="grid gap-4">
      <SectionCard
        title={isVietnamese ? 'Tình hình vận hành theo nhà hàng' : 'Restaurant operations snapshot'}
        description={
          isVietnamese
            ? 'Chọn một nhà hàng để đi vào nhập liệu, đồng bộ hoặc thu thập. Màn này dành cho quyết định vận hành, không phải màn merchant.'
            : 'Select a restaurant and branch into intake, review sync, or crawl controls.'
        }
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {isVietnamese ? 'Số nhà hàng' : 'Restaurants'}
            </div>
            <div className="mt-2 text-[1.15rem] font-semibold text-text-charcoal dark:text-white">
              {formatNumber(restaurants.length, language)}
            </div>
          </div>
          <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {isVietnamese ? 'Nguồn hoạt động' : 'Active sources'}
            </div>
            <div className="mt-2 text-[1.15rem] font-semibold text-text-charcoal dark:text-white">
              {formatNumber(detail?.adminFlow.sourceStats.activeCount ?? currentRestaurant?.activeSourceCount ?? 0, language)}
            </div>
          </div>
          <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {isVietnamese ? 'Lô chờ duyệt' : 'Pending batches'}
            </div>
            <div className="mt-2 text-[1.15rem] font-semibold text-text-charcoal dark:text-white">
              {formatNumber(detail?.userFlow.datasetStatus.pendingBatchCount ?? 0, language)}
            </div>
          </div>
          <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {isVietnamese ? 'Lần công bố gần nhất' : 'Last publish'}
            </div>
            <div className="mt-2 text-[1rem] font-semibold text-text-charcoal dark:text-white">
              {formatDateTime(detail?.userFlow.datasetStatus.lastPublishedAt, language)}
            </div>
          </div>
        </div>
      </SectionCard>

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard
          title={isVietnamese ? 'Danh sách nhà hàng' : 'Restaurant directory'}
          description={
            isVietnamese
              ? 'Đây là nơi admin chọn ngữ cảnh theo nhà hàng trước khi sang nhập liệu, đồng bộ hoặc thu thập.'
              : 'Choose the restaurant-scoped context before opening operations.'
          }
        >
          <div className="grid gap-2.5">
            {restaurants.map((restaurant) => {
              const isActive = restaurant.id === currentRestaurant?.id

              return (
                <button
                  key={restaurant.id}
                  type="button"
                  className={`grid gap-2 rounded-[0.85rem] border px-3 py-3 text-left transition ${
                    isActive
                      ? 'border-primary/28 bg-primary/[0.06]'
                      : 'border-border-light/70 bg-bg-light/60 hover:border-primary/18 hover:bg-white/60 dark:border-border-dark dark:bg-bg-dark/55'
                  }`}
                  onClick={() => onSelectRestaurant(restaurant.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-text-charcoal dark:text-white">
                        {restaurant.name}
                      </div>
                      <div className="mt-1 text-[12px] leading-6 text-text-silver-light dark:text-text-silver-dark">
                        {restaurant.address ?? (isVietnamese ? 'Chưa có địa chỉ' : 'No address')}
                      </div>
                    </div>
                    <span className="rounded-full border border-border-light/70 bg-surface-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
                      {formatNumber(restaurant.totalReviews, language)} {isVietnamese ? 'đánh giá' : 'reviews'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border-light/70 bg-white/70 px-2.5 py-1 text-[10px] font-medium text-text-silver-light dark:border-border-dark dark:bg-surface-dark/70 dark:text-text-silver-dark">
                      {formatNumber(restaurant.memberCount, language)} {isVietnamese ? 'thành viên' : 'members'}
                    </span>
                    <span className="rounded-full border border-border-light/70 bg-white/70 px-2.5 py-1 text-[10px] font-medium text-text-silver-light dark:border-border-dark dark:bg-surface-dark/70 dark:text-text-silver-dark">
                      {formatNumber(restaurant.pendingBatchCount, language)} {isVietnamese ? 'lô chờ duyệt' : 'pending batches'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard
          title={isVietnamese ? 'Bối cảnh nhà hàng đang chọn' : 'Selected restaurant context'}
          description={
            isVietnamese
              ? 'Từ đây admin quyết định nên đi sang nhập liệu, đồng bộ đánh giá hay thu thập chi tiết.'
              : 'Choose the next restaurant-scoped operation from this snapshot.'
          }
        >
          {!currentRestaurant ? (
            <StatusMessage>{isVietnamese ? 'Chưa có nhà hàng để xem.' : 'No restaurant available yet.'}</StatusMessage>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Nhà hàng' : 'Restaurant'}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-text-charcoal dark:text-white">
                    {currentRestaurant.name}
                  </div>
                </div>
                <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Chính sách nguồn' : 'Source policy'}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-text-charcoal dark:text-white">
                    {sourceStatus}
                  </div>
                </div>
                <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Đã duyệt' : 'Approved'}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-text-charcoal dark:text-white">
                    {formatNumber(detail?.userFlow.datasetStatus.approvedItemCount ?? 0, language)}
                  </div>
                </div>
                <div className="rounded-[0.82rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Sẵn sàng công bố' : 'Ready to publish'}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold text-text-charcoal dark:text-white">
                    {formatNumber(detail?.userFlow.datasetStatus.readyBatchCount ?? 0, language)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-[0.78rem] bg-primary px-4 text-sm font-semibold text-[#08131b] transition hover:bg-primary-dark"
                  onClick={() => onNavigate('/admin/operations/intake')}
                >
                  {labels.navIntake}
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-[0.78rem] border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/25 hover:text-primary dark:border-border-dark dark:text-white"
                  onClick={() => onNavigate('/admin/operations/review-ops')}
                >
                  {labels.navReviewOps}
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-[0.78rem] border border-border-light px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/25 hover:text-primary dark:border-border-dark dark:text-white"
                  onClick={() => onNavigate('/admin/operations/crawl')}
                >
                  {labels.navReviewCrawl}
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.95fr)]">
                <div className="rounded-[0.85rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Việc cần xử lý tiếp' : 'Next actions'}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {nextActions.length ? (
                      nextActions.map((action) => (
                        <div
                          key={action}
                          className="rounded-[0.75rem] border border-border-light/70 bg-surface-white/85 px-3 py-3 text-[13px] leading-6 text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white"
                        >
                          {action}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[0.75rem] border border-dashed border-border-light/80 bg-white/70 px-3 py-3 text-[13px] leading-6 text-text-silver-light dark:border-border-dark dark:bg-surface-dark/60 dark:text-text-silver-dark">
                        {isVietnamese ? 'Chưa có việc cần xử lý tiếp.' : 'No follow-up actions yet.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[0.85rem] border border-border-light/70 bg-bg-light/70 p-3 dark:border-border-dark dark:bg-bg-dark/55">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                    {isVietnamese ? 'Góc nhìn admin' : 'Admin lens'}
                  </div>
                  <div className="mt-3 text-[13px] leading-7 text-text-charcoal dark:text-white">
                    {isVietnamese
                      ? 'Màn này không hiển thị insight dành cho chủ quán. Nó chỉ trả lời ba câu hỏi: quán nào đang theo dõi, dữ liệu đang sẵn sàng đến đâu, và admin nên đi vào bước vận hành nào tiếp theo.'
                      : 'This view stays operational. It answers which restaurant is in scope, how ready its data is, and which admin action should follow.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
