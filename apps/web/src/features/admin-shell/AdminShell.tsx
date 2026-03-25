import { useEffect, useMemo, useState } from 'react'
import { StatusMessage } from '../../components/product/workspace/shared'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { getRoleDescriptor } from '../access/restaurantAccess'
import { getAdminOpsLabels } from '../admin-ops/adminOpsLabels'
import { getAdminNavigation, getRouteMeta } from '../app-shell/navigation'
import {
  isAdminAccessRoute,
  isAdminOperationsRoute,
  isAdminPlatformRoute,
  type AdminRoute,
  type AppRoute,
} from '../app-shell/routes'
import { ShellLayout } from '../app-shell/ShellLayout'
import { AdminIntakePanel } from '../admin-intake/components/AdminIntakePanel'
import { AdminRestaurantsOverview } from './AdminRestaurantsOverview'
import {
  getAdminHubDomainFromView,
  type AdminHubViewKey,
  AdminHubDomainScreen,
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
  const labels = getAdminOpsLabels(language)
  const roleDescriptor = getRoleDescriptor('ADMIN', language)
  const [restaurants, setRestaurants] = useState<AdminRestaurantSummary[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const isOperationsRoute = isAdminOperationsRoute(route)
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
  }, [feedbackCopy.errors.loadRestaurant, onSessionExpiry, refreshKey])

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

  const badges = [
    {
      label: `${formatCount(restaurants.length, language)} restaurants`,
      tone: 'neutral' as const,
    },
    {
      label: `${formatCount(activeSourceCount, language)} live sources`,
      tone: activeSourceCount > 0 ? ('success' as const) : ('warning' as const),
    },
    {
      label: `${formatCount(pendingBatchCount, language)} pending batches`,
      tone: pendingBatchCount > 0 ? ('warning' as const) : ('neutral' as const),
    },
  ]

  const contextSlot = route === '/admin' ? (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Admin picture
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Operations</div>
          <div className="mt-2 text-[14px] font-semibold text-white">Live now</div>
          <div className="mt-1 text-[12px] leading-5 text-slate-400">
            Restaurants, intake, review ops, and crawl already map to backend endpoints.
          </div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Expansion</div>
          <div className="mt-2 text-[14px] font-semibold text-white">Access + Platform next</div>
          <div className="mt-1 text-[12px] leading-5 text-slate-400">
            Users, memberships, health, policies, and audit are reserved as target-state screens.
          </div>
        </div>
      </div>
    </div>
  ) : isOperationsRoute ? (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Operation context
      </div>
      <div className="text-[18px] font-semibold text-white">
        {currentRestaurant?.name ?? 'No restaurant selected'}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Source policy</div>
          <div className="mt-2 text-[13px] font-semibold text-white">
            {detail?.userFlow.datasetStatus.sourcePolicy ?? 'UNCONFIGURED'}
          </div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Ready to publish</div>
          <div className="mt-2 text-[13px] font-semibold text-white">{formatCount(readyBatchCount, language)}</div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Approved items</div>
          <div className="mt-2 text-[13px] font-semibold text-white">{formatCount(approvedItemCount, language)}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {isAdminAccessRoute(route) ? 'Access scope' : 'Platform scope'}
      </div>
      <div className="text-[18px] font-semibold text-white">
        {isAdminAccessRoute(route) ? 'Identity and membership administration' : 'System-level operations'}
      </div>
      <div className="text-[12px] leading-6 text-slate-400">
        {isAdminAccessRoute(route)
          ? 'These screens are reserved in the IA now and should be backed by dedicated admin access endpoints next.'
          : 'These surfaces define the broader control-plane target state: health, policies, integrations, and audit.'}
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
          No restaurant selected.
        </div>
      )}
      <div className="grid gap-2">
        <div className="border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-slate-300">
          {activeSourceCount > 0 ? 'Source configured' : 'Source missing'}
        </div>
        <div className="border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-slate-300">
          {formatCount(currentRestaurant?.totalReviews, language)} reviews
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-2 text-[12px] leading-6 text-slate-400">
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {isAdminAccessRoute(route)
          ? 'Next: add admin users and memberships endpoints.'
          : 'Next: add aggregated platform and audit endpoints.'}
      </div>
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        Role boundary remains strict: only ADMIN can see these groups.
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
        <StatusMessage tone="error">No restaurant overview is available yet.</StatusMessage>
      ) : null}

      {route === '/admin' ? (
        <AdminHubHomeScreen
          activeView={currentAdminView}
          onNavigate={(view) => onNavigate(getRouteFromAdminView(view))}
        />
      ) : isAdminAccessRoute(route) || isAdminPlatformRoute(route) ? (
        <AdminHubDomainScreen
          domainKey={getAdminHubDomainFromView(currentAdminView)}
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
        <AdminIntakePanel
          language={language}
          restaurantId={currentRestaurantId}
          detail={restaurantDetail}
          onPublished={onDataChanged}
        />
      ) : route === '/admin/operations/review-ops' ? (
        <ReviewOpsPanel
          language={language}
          restaurantId={currentRestaurantId}
          detail={restaurantDetail}
          onPublished={onDataChanged}
        />
      ) : (
        <ReviewCrawlPanel
          language={language}
          restaurantId={currentRestaurantId}
          detail={restaurantDetail}
          onMaterialized={onDataChanged}
        />
      )}
    </ShellLayout>
  )
}
