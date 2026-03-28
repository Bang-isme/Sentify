import type { ProductUiCopy } from '../../content/productUiCopy'
import type { AppRoute } from '../app-shell/routes'
import type { AdminOpsLabels } from '../admin-ops/adminOpsLabels'
import type { AdminRestaurantDetail, AdminRestaurantSummary } from '../../lib/api'
import {
  AdminCard,
  AdminDataCell,
  AdminStatusMessage,
  AdminButton,
} from './components/AdminPrimitives'

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
    <div data-testid="admin-overview" className="grid gap-6 auto-rows-min">
      <AdminCard
        title={isVietnamese ? 'Tình hình vận hành' : 'Operations snapshot'}
        description={
          isVietnamese
            ? 'Tổng quan toàn bộ nhà hàng trên hệ thống.'
            : 'Overview of all restaurants connected to the platform.'
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminDataCell
            label={isVietnamese ? 'Số nhà hàng' : 'Restaurants'}
            value={formatNumber(restaurants.length, language)}
          />
          <AdminDataCell
            label={isVietnamese ? 'Nguồn hoạt động' : 'Active sources'}
            value={formatNumber(detail?.adminFlow.sourceStats.activeCount ?? currentRestaurant?.activeSourceCount ?? 0, language)}
          />
          <AdminDataCell
            label={isVietnamese ? 'Lô chờ duyệt' : 'Pending batches'}
            value={formatNumber(detail?.userFlow.datasetStatus.pendingBatchCount ?? 0, language)}
          />
          <AdminDataCell
            label={isVietnamese ? 'Lần công bố gần' : 'Last publish'}
            value={<div className="text-[1.05rem] font-bold">{formatDateTime(detail?.userFlow.datasetStatus.lastPublishedAt, language)}</div>}
          />
        </div>
      </AdminCard>

      {error ? <AdminStatusMessage tone="error">{error}</AdminStatusMessage> : null}
      {loading ? <AdminStatusMessage>{copy.loadingRestaurant}</AdminStatusMessage> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] items-start">
        <AdminCard
          title={isVietnamese ? 'Danh sách nhà hàng' : 'Restaurant directory'}
          description={
            isVietnamese
              ? 'Chọn nhà hàng để bắt đầu phiên vận hành.'
              : 'Choose a restaurant to begin operations context.'
          }
          className="h-full"
        >
          <div className="flex flex-col gap-3">
            {restaurants.map((restaurant) => {
              const isActive = restaurant.id === currentRestaurant?.id

              return (
                <button
                  key={restaurant.id}
                  type="button"
                  onClick={() => onSelectRestaurant(restaurant.id)}
                  className={`flex flex-col gap-2 p-3.5 text-left rounded-xl border transition-all ${
                    isActive
                      ? 'border-indigo-500/30 bg-indigo-50/50 dark:border-white/20 dark:bg-white/10 ring-1 ring-indigo-500/20 dark:ring-white/10'
                      : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/5 dark:bg-[#18181b] dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between w-full min-w-0 gap-3">
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-white [overflow-wrap:anywhere]">
                        {restaurant.name}
                      </div>
                      <div className="text-[13px] text-slate-500 dark:text-zinc-400 mt-1 [overflow-wrap:anywhere]">
                        {restaurant.address ?? (isVietnamese ? 'Chưa có địa chỉ' : 'No address')}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                      {formatNumber(restaurant.totalReviews, language)} HW
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-[12px] font-medium text-slate-500 dark:text-zinc-400">
                      {formatNumber(restaurant.memberCount, language)} {isVietnamese ? 'thành viên' : 'members'}
                    </span>
                    <span className="text-slate-300 dark:text-zinc-600">•</span>
                    <span className="text-[12px] font-medium text-slate-500 dark:text-zinc-400">
                      {formatNumber(restaurant.pendingBatchCount, language)} {isVietnamese ? 'lô chờ duyệt' : 'pending batches'}
                    </span>
                  </div>
                </button>
              )
            })}
            
            {restaurants.length === 0 && !loading && !error ? (
              <AdminStatusMessage>
                {isVietnamese ? 'Chưa có nhà hàng nào trên hệ thống.' : 'No restaurants registered.'}
              </AdminStatusMessage>
            ) : null}
          </div>
        </AdminCard>

        <AdminCard
          title={isVietnamese ? 'Bối cảnh chi tiết' : 'Selected context'}
          description={
            isVietnamese
              ? 'Chi tiết các đầu việc cần xử lý và shortcut tác vụ.'
              : 'Details and action shortcuts for this restaurant.'
          }
          className="h-full"
        >
          {!currentRestaurant ? (
            <AdminStatusMessage>
              {isVietnamese ? 'Chưa có nhà hàng để xem.' : 'No restaurant available yet.'}
            </AdminStatusMessage>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminDataCell
                  label={isVietnamese ? 'Chính sách nguồn' : 'Source policy'}
                  value={<div className="text-[1.1rem] leading-tight">{sourceStatus}</div>}
                />
                <AdminDataCell
                  label={isVietnamese ? 'Sẵn sàng công bố' : 'Ready to publish'}
                  value={formatNumber(detail?.userFlow.datasetStatus.readyBatchCount ?? 0, language)}
                  secondaryValue={
                    `${formatNumber(detail?.userFlow.datasetStatus.approvedItemCount ?? 0, language)} ${isVietnamese ? 'đánh giá đã duyệt' : 'approved items'}`
                  }
                />
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
                  {isVietnamese ? 'Luồng công việc' : 'Workflow shortcuts'}
                </div>
                <div className="flex flex-wrap gap-3">
                  <AdminButton variant="primary" onClick={() => onNavigate('/admin/operations/intake')}>
                    {labels.navIntake}
                  </AdminButton>
                  <AdminButton variant="secondary" onClick={() => onNavigate('/admin/operations/review-ops')}>
                    {labels.navReviewOps}
                  </AdminButton>
                  <AdminButton variant="secondary" onClick={() => onNavigate('/admin/operations/crawl')}>
                    {labels.navReviewCrawl}
                  </AdminButton>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                  {isVietnamese ? 'Việc cần xử lý tiếp' : 'Next actions'}
                </div>
                <div className="flex flex-col gap-2">
                  {nextActions.length ? (
                    nextActions.map((action) => (
                      <div
                        key={action}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] leading-snug text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                      >
                        {action}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[13px] text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
                      {isVietnamese ? 'Chưa có việc cần xử lý tiếp.' : 'No follow-up actions yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  )
}
