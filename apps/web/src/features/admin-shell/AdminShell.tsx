import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AdminStatusMessage } from './components/AdminPrimitives'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { getAdminOpsLabels } from '../admin-ops/adminOpsLabels'
import { getAdminNavigation, getRouteMeta } from '../app-shell/navigation'
import {
  isAdminAccessRoute,
  isAdminOperationsRoute,
  type AdminRoute,
  type AppRoute,
} from '../app-shell/routes'
import { ShellLayout } from '../app-shell/ShellLayout'
import type { AdminHubViewKey } from '../admin-hub'
import { RestaurantSwitcher } from '../workspace/components/RestaurantSwitcher'
import {
  getAdminRestaurantDetail,
  listAdminRestaurants,
  type AdminRestaurantDetail,
  type AdminRestaurantSummary,
  type RestaurantDetail,
} from '../../lib/api'

const AdminMembershipsPanel = lazy(() =>
  import('../admin-access/components/AdminMembershipsPanel').then((module) => ({
    default: module.AdminMembershipsPanel,
  })),
)
const AdminUsersPanel = lazy(() =>
  import('../admin-access/components/AdminUsersPanel').then((module) => ({
    default: module.AdminUsersPanel,
  })),
)
const AdminIntakePanel = lazy(() =>
  import('../admin-intake/components/AdminIntakePanel').then((module) => ({
    default: module.AdminIntakePanel,
  })),
)
const AdminAuditPanel = lazy(() =>
  import('../admin-platform/components/AdminAuditPanel').then((module) => ({
    default: module.AdminAuditPanel,
  })),
)
const AdminHealthJobsPanel = lazy(() =>
  import('../admin-platform/components/AdminHealthJobsPanel').then((module) => ({
    default: module.AdminHealthJobsPanel,
  })),
)
const AdminIntegrationsPoliciesPanel = lazy(() =>
  import('../admin-platform/components/AdminIntegrationsPoliciesPanel').then((module) => ({
    default: module.AdminIntegrationsPoliciesPanel,
  })),
)
const AdminRestaurantsOverview = lazy(() =>
  import('./AdminRestaurantsOverview').then((module) => ({ default: module.AdminRestaurantsOverview })),
)
const AdminHubHomeScreen = lazy(() =>
  import('../admin-hub/screens/AdminHubHomeScreen').then((module) => ({
    default: module.AdminHubHomeScreen,
  })),
)
const ReviewCrawlPanel = lazy(() =>
  import('../review-crawl/components/ReviewCrawlPanel').then((module) => ({
    default: module.ReviewCrawlPanel,
  })),
)
const ReviewOpsPanel = lazy(() =>
  import('../review-ops/components/ReviewOpsPanel').then((module) => ({
    default: module.ReviewOpsPanel,
  })),
)

interface AdminShellProps {
  route: AdminRoute
  copy: ProductUiCopy['app']
  feedbackCopy: ProductUiCopy['feedback']
  language: string
  refreshKey: number
  selectedRestaurantId: string | null
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: AppRoute) => void
  onSessionExpiry: (error: unknown) => boolean
  onDataChanged: () => void
}

function mapAdminDetailToRestaurantDetail(detail: AdminRestaurantDetail | null): RestaurantDetail | null {
  if (!detail) {
    return null
  }

  return {
    id: detail.restaurant.id,
    name: detail.restaurant.name,
    slug: detail.restaurant.slug,
    address: detail.restaurant.address,
    googleMapUrl: detail.restaurant.googleMapUrl,
    datasetStatus: detail.userFlow.datasetStatus,
    insightSummary: detail.userFlow.insightSummary,
  }
}

function formatCount(value: number | null | undefined, language: string) {
  return new Intl.NumberFormat(language).format(value ?? 0)
}

function getAdminViewFromRoute(route: AdminRoute): AdminHubViewKey {
  switch (route) {
    case '/admin':
      return 'home'
    case '/admin/operations/restaurants':
      return 'operations-restaurants'
    case '/admin/operations/intake':
      return 'operations-intake'
    case '/admin/operations/review-ops':
      return 'operations-review-ops'
    case '/admin/operations/crawl':
      return 'operations-crawl'
    case '/admin/access/users':
      return 'access-users'
    case '/admin/access/memberships':
      return 'access-memberships'
    case '/admin/platform/health-jobs':
      return 'platform-health-jobs'
    case '/admin/platform/integrations-policies':
      return 'platform-integrations-policies'
    case '/admin/platform/audit':
      return 'platform-audit'
  }
}

function getRouteFromAdminView(view: AdminHubViewKey): AdminRoute {
  switch (view) {
    case 'home':
      return '/admin'
    case 'operations-restaurants':
      return '/admin/operations/restaurants'
    case 'operations-intake':
      return '/admin/operations/intake'
    case 'operations-review-ops':
      return '/admin/operations/review-ops'
    case 'operations-crawl':
      return '/admin/operations/crawl'
    case 'access-users':
      return '/admin/access/users'
    case 'access-memberships':
      return '/admin/access/memberships'
    case 'platform-health-jobs':
      return '/admin/platform/health-jobs'
    case 'platform-integrations-policies':
      return '/admin/platform/integrations-policies'
    case 'platform-audit':
      return '/admin/platform/audit'
  }
}

export function AdminShell({
  route,
  copy,
  feedbackCopy,
  language,
  refreshKey,
  selectedRestaurantId,
  onSelectRestaurant,
  onNavigate,
  onSessionExpiry,
  onDataChanged,
}: AdminShellProps) {
  const isVietnamese = language.startsWith('vi')
  const labels = getAdminOpsLabels(language)
  const [restaurants, setRestaurants] = useState<AdminRestaurantSummary[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const isOperationsRoute = isAdminOperationsRoute(route)
  const needsOperationsData = isOperationsRoute
  const currentAdminView = getAdminViewFromRoute(route)
  const routeMeta = getRouteMeta(route, language)

  const currentRestaurantId = useMemo(() => {
    if (selectedRestaurantId && restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
      return selectedRestaurantId
    }

    return restaurants[0]?.id ?? null
  }, [restaurants, selectedRestaurantId])

  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.id === currentRestaurantId) ?? restaurants[0] ?? null

  useEffect(() => {
    if (!needsOperationsData) {
      setRestaurants([])
      setOverviewLoading(false)
      setOverviewError(null)
      return undefined
    }

    let cancelled = false

    async function loadRestaurants() {
      setOverviewLoading(true)
      setOverviewError(null)

      try {
        const nextRestaurants = await listAdminRestaurants()

        if (cancelled) {
          return
        }

        setRestaurants(nextRestaurants)
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!onSessionExpiry(error)) {
          setOverviewError(error instanceof Error ? error.message : feedbackCopy.errors.loadRestaurant)
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false)
        }
      }
    }

    void loadRestaurants()

    return () => {
      cancelled = true
    }
  }, [feedbackCopy.errors.loadRestaurant, needsOperationsData, onSessionExpiry, refreshKey])

  useEffect(() => {
    if (!currentRestaurantId || !isOperationsRoute) {
      setDetail(null)
      return undefined
    }

    let cancelled = false

    async function loadDetail() {
      setDetailLoading(true)
      setDetailError(null)

      try {
        const nextDetail = await getAdminRestaurantDetail(currentRestaurantId)

        if (cancelled) {
          return
        }

        setDetail(nextDetail)
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!onSessionExpiry(error)) {
          setDetailError(error instanceof Error ? error.message : feedbackCopy.errors.loadRestaurant)
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [currentRestaurantId, feedbackCopy.errors.loadRestaurant, isOperationsRoute, onSessionExpiry, refreshKey])

  useEffect(() => {
    if (!restaurants.length || !isOperationsRoute) {
      return
    }

    if (!selectedRestaurantId || !restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
      onSelectRestaurant(restaurants[0].id)
    }
  }, [isOperationsRoute, onSelectRestaurant, restaurants, selectedRestaurantId])

  const pendingBatchCount = detail?.userFlow.datasetStatus.pendingBatchCount ?? currentRestaurant?.pendingBatchCount ?? 0
  const readyBatchCount = detail?.userFlow.datasetStatus.readyBatchCount ?? 0
  const activeSourceCount = detail?.adminFlow.sourceStats.activeCount ?? currentRestaurant?.activeSourceCount ?? 0
  const approvedItemCount = detail?.userFlow.datasetStatus.approvedItemCount ?? 0
  const restaurantDetail = mapAdminDetailToRestaurantDetail(detail)
  const routePanelFallback = (
    <AdminStatusMessage>{isVietnamese ? 'Đang tải màn quản trị...' : 'Loading admin screen...'}</AdminStatusMessage>
  )

  const badges = route === '/admin'
    ? [
        {
          label: isVietnamese ? 'Vận hành đang dùng' : 'Operations live',
          tone: 'success' as const,
        },
        {
          label: isVietnamese ? 'Quyền truy cập đang dùng' : 'Access live',
          tone: 'success' as const,
        },
        {
          label: isVietnamese ? 'Nền tảng đang dùng' : 'Platform live',
          tone: 'success' as const,
        },
      ]
    : isOperationsRoute
      ? [
          {
            label: isVietnamese
              ? `${formatCount(restaurants.length, language)} nhà hàng`
              : `${formatCount(restaurants.length, language)} restaurants`,
            tone: 'neutral' as const,
          },
          {
            label: isVietnamese
              ? `${formatCount(activeSourceCount, language)} nguồn đang hoạt động`
              : `${formatCount(activeSourceCount, language)} live sources`,
            tone: activeSourceCount > 0 ? ('success' as const) : ('warning' as const),
          },
          {
            label: isVietnamese
              ? `${formatCount(pendingBatchCount, language)} lô đang chờ`
              : `${formatCount(pendingBatchCount, language)} pending batches`,
            tone: pendingBatchCount > 0 ? ('warning' as const) : ('neutral' as const),
          },
        ]
      : isAdminAccessRoute(route)
        ? [
            {
              label: isVietnamese ? 'Phạm vi quản trị toàn cục' : 'Global admin scope',
              tone: 'neutral' as const,
            },
            {
              label: isVietnamese ? 'Mô hình USER + ADMIN' : 'USER + ADMIN model',
              tone: 'success' as const,
            },
          ]
        : [
            {
              label: isVietnamese ? 'Theo dõi sức khỏe hệ thống' : 'Health visibility',
              tone: 'neutral' as const,
            },
            {
              label: isVietnamese ? 'Theo dõi lịch sử tác động' : 'Audit visibility',
              tone: 'success' as const,
            },
          ]

  const contextSlot = route === '/admin' ? (
    <div className="grid gap-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
        {isVietnamese ? 'Bức tranh điều hành' : 'Control-plane map'}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVietnamese ? 'Vận hành' : 'Operations'}
          </div>
          <div className="mt-2 text-[15px] font-bold text-slate-900 dark:text-white">
            {isVietnamese ? 'Xử lý nhà hàng và dữ liệu' : 'Live now'}
          </div>
          <div className="mt-1 text-[13px] leading-relaxed text-slate-500">
            {isVietnamese
              ? 'Đi từ danh sách nhà hàng sang nhập liệu, đồng bộ đánh giá và thu thập đánh giá theo từng nhà hàng.'
              : 'Restaurants, intake, review ops, and crawl already map to backend endpoints.'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVietnamese ? 'Quyền truy cập' : 'Access'}
          </div>
          <div className="mt-2 text-[15px] font-bold text-slate-900 dark:text-white">
            {isVietnamese ? 'Người dùng và phạm vi nhìn thấy' : 'Users and memberships'}
          </div>
          <div className="mt-1 text-[13px] leading-relaxed text-slate-500">
            {isVietnamese
              ? 'Quản trị tài khoản, vai trò hệ thống và quyền nhìn thấy nhà hàng trong cùng một nơi.'
              : 'Identity and restaurant visibility now live in the same admin product.'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b] sm:col-span-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVietnamese ? 'Nền tảng' : 'Platform'}
          </div>
          <div className="mt-2 text-[15px] font-bold text-slate-900 dark:text-white">
            {isVietnamese ? 'Sức khỏe hệ thống, chính sách và nhật ký' : 'Health, policy, and audit'}
          </div>
          <div className="mt-1 text-[13px] leading-relaxed text-slate-500">
            {isVietnamese
              ? 'Theo dõi trạng thái queue, chính sách tích hợp và lịch sử tác động để hiểu hệ thống đang vận hành ra sao.'
              : 'Queue state, integration defaults, and audit history explain how the backend actually behaves behind the UI.'}
          </div>
        </div>
      </div>
    </div>
  ) : isOperationsRoute ? (
    <div className="grid gap-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {isVietnamese ? 'Bối cảnh nhà hàng' : 'Operation context'}
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white [overflow-wrap:anywhere]">
        {currentRestaurant?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVietnamese ? 'Chính sách nguồn' : 'Source policy'}
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">
            {detail?.userFlow.datasetStatus.sourcePolicy ?? 'UNCONFIGURED'}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVietnamese ? 'Sẵn sàng công bố' : 'Ready to publish'}
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">
            {formatCount(readyBatchCount, language)}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVietnamese ? 'Mục đã duyệt' : 'Approved items'}
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">
            {formatCount(approvedItemCount, language)}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="grid gap-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {isAdminAccessRoute(route)
          ? isVietnamese
            ? 'Phạm vi quyền truy cập'
            : 'Access scope'
          : isVietnamese
            ? 'Phạm vi nền tảng'
            : 'Platform scope'}
      </div>
      <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {isAdminAccessRoute(route)
          ? isVietnamese
            ? 'Quản trị tài khoản và thành viên nhà hàng'
            : 'Identity and membership administration'
          : isVietnamese
            ? 'Theo dõi hệ thống, chính sách và nhật ký'
            : 'System health, policy, and audit'}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-500 shadow-sm dark:border-white/10 dark:bg-[#18181b] dark:text-zinc-400">
        {isAdminAccessRoute(route)
          ? isVietnamese
            ? 'Các màn này dùng API quản trị riêng để quản lý tài khoản và phạm vi nhà hàng mà không trộn vào trải nghiệm của USER.'
            : 'These screens use dedicated admin access endpoints so user management stays separate from merchant UX.'
          : isVietnamese
            ? 'Các màn này cho thấy tình trạng hệ thống, chính sách vận hành và lịch sử tác động đang đứng sau giao diện.'
            : 'These screens expose the health checks, defaults, and audit evidence that explain the system behind the UI.'}
      </div>
    </div>
  )

  const sidebarFooter = isOperationsRoute ? (
    <div className="space-y-4">
      {currentRestaurant ? (
        <RestaurantSwitcher
          copy={copy}
          restaurants={restaurants.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            googleMapUrl: restaurant.googleMapUrl,
            totalReviews: restaurant.totalReviews,
          }))}
          currentRestaurant={{
            id: currentRestaurant.id,
            name: currentRestaurant.name,
            slug: currentRestaurant.slug,
            googleMapUrl: currentRestaurant.googleMapUrl,
            totalReviews: currentRestaurant.totalReviews,
          }}
          onSelectRestaurant={onSelectRestaurant}
          showLabel={false}
          compact
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-500">
          {isVietnamese ? 'Chưa chọn nhà hàng.' : 'No restaurant selected.'}
        </div>
      )}
      <div className="flex flex-col gap-2.5 opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300 px-1 py-1">
        <div className="flex items-center gap-2.5 text-[12px] font-medium text-slate-500 dark:text-zinc-400">
           <span className="relative flex size-2 shrink-0">
             {activeSourceCount > 0 ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </>
             ) : (
                <span className="relative inline-flex rounded-full size-2 bg-rose-500"></span>
             )}
           </span>
           <span className="truncate">
             {activeSourceCount > 0
               ? isVietnamese ? 'Nguồn đã kết nối' : 'Source connected'
               : isVietnamese ? 'Thiếu nguồn' : 'Source missing'}
           </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-zinc-400">
          <span className="material-symbols-outlined text-[14px] shrink-0">star</span>
          <span className="truncate">
            {isVietnamese
              ? `${formatCount(currentRestaurant?.totalReviews, language)} đánh giá thu thập`
              : `${formatCount(currentRestaurant?.totalReviews, language)} reviews collected`}
          </span>
        </div>
      </div>
    </div>
  ) : (
    <div className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-rose-500/20 bg-rose-50/50 p-3 shadow-sm transition hover:border-rose-500/30 dark:border-rose-500/20 dark:bg-rose-500/5">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-500/20">
          <span className="material-symbols-outlined text-[16px] text-rose-600 dark:text-rose-400">shield_lock</span>
        </div>
        <div className="flex flex-col min-w-0 opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300">
          <span className="text-[13px] font-bold text-rose-700 dark:text-rose-400">
            {isVietnamese ? 'Khu vực quản trị' : 'Admin Area'}
          </span>
          <span className="truncate text-[11px] text-rose-600/70 dark:text-rose-400/70">
            {isVietnamese ? 'Cấp quyền cao nhất' : 'Highest clearance'}
          </span>
        </div>
      </div>
      <span className="material-symbols-outlined shrink-0 text-[18px] text-rose-500/50 transition-transform group-hover:translate-x-0.5 dark:text-rose-400/50 opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 duration-300">
        chevron_right
      </span>
    </div>
  )

  return (
    <ShellLayout
      mode="admin"
      route={route}
      language={language}
      sectionLabel={routeMeta.sectionLabel}
      title={routeMeta.title}
      description={routeMeta.description}
      stage={routeMeta.stage}
      navGroups={getAdminNavigation(language)}
      badges={badges}
      contextSlot={contextSlot}
      sidebarFooter={sidebarFooter}
      onNavigate={(nextRoute) => onNavigate(nextRoute)}
    >
      {overviewError ? <AdminStatusMessage tone="error">{overviewError}</AdminStatusMessage> : null}
      {detailError ? <AdminStatusMessage tone="error">{detailError}</AdminStatusMessage> : null}
      {overviewLoading ? <AdminStatusMessage>{copy.loadingRestaurant}</AdminStatusMessage> : null}
      {detailLoading && isOperationsRoute ? <AdminStatusMessage>{copy.loadingRestaurant}</AdminStatusMessage> : null}

      {!restaurants.length && !overviewLoading && isOperationsRoute ? (
        <AdminStatusMessage tone="error">
          {isVietnamese ? 'Chưa có dữ liệu nhà hàng để vận hành.' : 'No restaurant overview is available yet.'}
        </AdminStatusMessage>
      ) : null}

      <Suspense fallback={routePanelFallback}>
        {route === '/admin' ? (
          <AdminHubHomeScreen
            activeView={currentAdminView}
            onNavigate={(view) => onNavigate(getRouteFromAdminView(view))}
          />
        ) : route === '/admin/operations/restaurants' ? (
          <AdminRestaurantsOverview
            language={language}
            copy={copy}
            labels={labels}
            restaurants={restaurants}
            currentRestaurant={currentRestaurant}
            detail={detail}
            loading={overviewLoading || detailLoading}
            error={overviewError ?? detailError}
            onSelectRestaurant={onSelectRestaurant}
            onNavigate={onNavigate}
          />
        ) : route === '/admin/operations/intake' ? (
          <div data-testid="admin-intake">
            <AdminIntakePanel
              language={language}
              restaurantId={currentRestaurantId}
              detail={restaurantDetail}
              onPublished={onDataChanged}
            />
          </div>
        ) : route === '/admin/operations/review-ops' ? (
          <div data-testid="admin-review-ops">
            <ReviewOpsPanel
              language={language}
              restaurantId={currentRestaurantId}
              detail={restaurantDetail}
              onPublished={onDataChanged}
            />
          </div>
        ) : route === '/admin/access/users' ? (
          <AdminUsersPanel
            language={language}
            refreshKey={refreshKey}
            onSessionExpiry={onSessionExpiry}
          />
        ) : route === '/admin/access/memberships' ? (
          <AdminMembershipsPanel
            language={language}
            refreshKey={refreshKey}
            onSessionExpiry={onSessionExpiry}
          />
        ) : route === '/admin/platform/health-jobs' ? (
          <AdminHealthJobsPanel
            language={language}
            refreshKey={refreshKey}
            onSessionExpiry={onSessionExpiry}
          />
        ) : route === '/admin/platform/integrations-policies' ? (
          <AdminIntegrationsPoliciesPanel
            language={language}
            refreshKey={refreshKey}
            onSessionExpiry={onSessionExpiry}
            onControlsUpdated={onDataChanged}
          />
        ) : route === '/admin/platform/audit' ? (
          <AdminAuditPanel
            language={language}
            refreshKey={refreshKey}
            onSessionExpiry={onSessionExpiry}
          />
        ) : (
          <div data-testid="admin-crawl">
            <ReviewCrawlPanel
              language={language}
              restaurantId={currentRestaurantId}
              detail={restaurantDetail}
              onMaterialized={onDataChanged}
            />
          </div>
        )}
      </Suspense>
    </ShellLayout>
  )
}
