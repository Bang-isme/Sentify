import { useEffect, useMemo, useState } from 'react'
import { StatusMessage } from '../../components/product/workspace/shared'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { getRoleDescriptor } from '../access/restaurantAccess'
import { getAdminOpsLabels } from '../admin-ops/adminOpsLabels'
import { getAdminNavigation, getRouteMeta } from '../app-shell/navigation'
import {
  isAdminAccessRoute,
  isAdminOperationsRoute,
  type AdminRoute,
  type AppRoute,
} from '../app-shell/routes'
import { ShellLayout } from '../app-shell/ShellLayout'
import { AdminMembershipsPanel } from '../admin-access/components/AdminMembershipsPanel'
import { AdminUsersPanel } from '../admin-access/components/AdminUsersPanel'
import { AdminIntakePanel } from '../admin-intake/components/AdminIntakePanel'
import { AdminAuditPanel } from '../admin-platform/components/AdminAuditPanel'
import { AdminHealthJobsPanel } from '../admin-platform/components/AdminHealthJobsPanel'
import { AdminIntegrationsPoliciesPanel } from '../admin-platform/components/AdminIntegrationsPoliciesPanel'
import { AdminRestaurantsOverview } from './AdminRestaurantsOverview'
import {
  type AdminHubViewKey,
  AdminHubHomeScreen,
} from '../admin-hub'
import { ReviewCrawlPanel } from '../review-crawl/components/ReviewCrawlPanel'
import { ReviewOpsPanel } from '../review-ops/components/ReviewOpsPanel'
import { RestaurantSwitcher } from '../workspace/components/RestaurantSwitcher'
import {
  getAdminRestaurantDetail,
  listAdminRestaurants,
  type AdminRestaurantDetail,
  type AdminRestaurantSummary,
  type RestaurantDetail,
} from '../../lib/api'

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
  const roleDescriptor = getRoleDescriptor('ADMIN', language)
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
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {isVietnamese ? 'Bức tranh điều hành' : 'Control-plane map'}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isVietnamese ? 'Vận hành' : 'Operations'}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-white">
            {isVietnamese ? 'Xử lý nhà hàng và dữ liệu' : 'Live now'}
          </div>
          <div className="mt-1 text-[12px] leading-5 text-slate-400">
            {isVietnamese
              ? 'Đi từ danh sách nhà hàng sang nhập liệu, đồng bộ đánh giá và thu thập đánh giá theo từng nhà hàng.'
              : 'Restaurants, intake, review ops, and crawl already map to backend endpoints.'}
          </div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isVietnamese ? 'Quyền truy cập' : 'Access'}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-white">
            {isVietnamese ? 'Người dùng và phạm vi nhìn thấy' : 'Users and memberships'}
          </div>
          <div className="mt-1 text-[12px] leading-5 text-slate-400">
            {isVietnamese
              ? 'Quản trị tài khoản, vai trò hệ thống và quyền nhìn thấy nhà hàng trong cùng một nơi.'
              : 'Identity and restaurant visibility now live in the same admin product.'}
          </div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3 sm:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isVietnamese ? 'Nền tảng' : 'Platform'}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-white">
            {isVietnamese ? 'Sức khỏe hệ thống, chính sách và nhật ký' : 'Health, policy, and audit'}
          </div>
          <div className="mt-1 text-[12px] leading-5 text-slate-400">
            {isVietnamese
              ? 'Theo dõi trạng thái queue, chính sách tích hợp và lịch sử tác động để hiểu hệ thống đang vận hành ra sao.'
              : 'Queue state, integration defaults, and audit history explain how the backend actually behaves behind the UI.'}
          </div>
        </div>
      </div>
    </div>
  ) : isOperationsRoute ? (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {isVietnamese ? 'Bối cảnh nhà hàng' : 'Operation context'}
      </div>
      <div className="text-[18px] font-semibold text-white">
        {currentRestaurant?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected')}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isVietnamese ? 'Chính sách nguồn' : 'Source policy'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">
            {detail?.userFlow.datasetStatus.sourcePolicy ?? 'UNCONFIGURED'}
          </div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isVietnamese ? 'Sẵn sàng công bố' : 'Ready to publish'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">{formatCount(readyBatchCount, language)}</div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {isVietnamese ? 'Mục đã duyệt' : 'Approved items'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">{formatCount(approvedItemCount, language)}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {isAdminAccessRoute(route)
          ? isVietnamese
            ? 'Phạm vi quyền truy cập'
            : 'Access scope'
          : isVietnamese
            ? 'Phạm vi nền tảng'
            : 'Platform scope'}
      </div>
      <div className="text-[18px] font-semibold text-white">
        {isAdminAccessRoute(route)
          ? isVietnamese
            ? 'Quản trị tài khoản và thành viên nhà hàng'
            : 'Identity and membership administration'
          : isVietnamese
            ? 'Theo dõi hệ thống, chính sách và nhật ký'
            : 'System health, policy, and audit'}
      </div>
      <div className="text-[12px] leading-6 text-slate-400">
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
    <div className="space-y-3">
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
        <div className="border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-slate-400">
          {isVietnamese ? 'Chưa chọn nhà hàng.' : 'No restaurant selected.'}
        </div>
      )}
      <div className="grid gap-2">
        <div className="border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-slate-300">
          {activeSourceCount > 0
            ? isVietnamese
              ? 'Nguồn đã sẵn sàng'
              : 'Source configured'
            : isVietnamese
              ? 'Thiếu nguồn'
              : 'Source missing'}
        </div>
        <div className="border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-slate-300">
          {isVietnamese
            ? `${formatCount(currentRestaurant?.totalReviews, language)} đánh giá`
            : `${formatCount(currentRestaurant?.totalReviews, language)} reviews`}
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-2 text-[12px] leading-6 text-slate-400">
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {isAdminAccessRoute(route)
          ? isVietnamese
            ? 'Phạm vi toàn cục: quản lý tài khoản và quyền nhìn thấy nhà hàng từ cùng một khu điều hành.'
            : 'Global scope: manage user identity and restaurant visibility from the same control plane.'
          : isVietnamese
            ? 'Phạm vi toàn cục: theo dõi hệ thống, chính sách và nhật ký mà không cần vào từng nhà hàng.'
            : 'Global scope: monitor runtime, policies, and audit without entering restaurant-scoped operations.'}
      </div>
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {isVietnamese
          ? 'Ranh giới vai trò luôn chặt: chỉ ADMIN mới thấy các nhóm màn này.'
          : 'Role boundary remains strict: only ADMIN can see these groups.'}
      </div>
    </div>
  )

  return (
    <ShellLayout
      mode="admin"
      route={route}
      language={language}
      productLabel={roleDescriptor.label}
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
      {overviewError ? <StatusMessage tone="error">{overviewError}</StatusMessage> : null}
      {detailError ? <StatusMessage tone="error">{detailError}</StatusMessage> : null}
      {overviewLoading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}
      {detailLoading && isOperationsRoute ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

      {!restaurants.length && !overviewLoading && isOperationsRoute ? (
        <StatusMessage tone="error">
          {isVietnamese ? 'Chưa có dữ liệu nhà hàng để vận hành.' : 'No restaurant overview is available yet.'}
        </StatusMessage>
      ) : null}

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
    </ShellLayout>
  )
}
