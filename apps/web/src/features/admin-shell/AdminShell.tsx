import { useEffect, useMemo, useState } from 'react'
import { StatusMessage } from '../../components/product/workspace/shared'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { getRoleDescriptor } from '../access/restaurantAccess'
import { getAdminOpsLabels } from '../admin-ops/adminOpsLabels'
import { AdminRestaurantsOverview } from './AdminRestaurantsOverview'
import { ReviewOpsPanel } from '../review-ops/components/ReviewOpsPanel'
import { ReviewCrawlPanel } from '../review-crawl/components/ReviewCrawlPanel'
import type { AdminRoute, AppRoute } from '../app-shell/routes'
import { WorkspaceScaffold } from '../workspace/components/WorkspaceScaffold'
import { AdminIntakePanel } from '../admin-intake/components/AdminIntakePanel'
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
    if (!currentRestaurantId) {
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
  }, [currentRestaurantId, feedbackCopy.errors.loadRestaurant, onSessionExpiry, refreshKey])

  useEffect(() => {
    if (!restaurants.length) {
      return
    }

    if (!selectedRestaurantId || !restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
      onSelectRestaurant(restaurants[0].id)
    }
  }, [onSelectRestaurant, restaurants, selectedRestaurantId])

  const hasSource = Boolean(currentRestaurant?.googleMapUrl)
  const pendingBatchCount = detail?.userFlow.datasetStatus.pendingBatchCount ?? currentRestaurant?.pendingBatchCount ?? 0
  const approvedItemCount = detail?.userFlow.datasetStatus.approvedItemCount ?? 0
  const restaurantDetail = mapAdminDetailToRestaurantDetail(detail)
  const shellTitle =
    route === '/admin'
      ? labels.overviewTitle
      : route === '/admin/intake'
        ? labels.navIntake
        : route === '/admin/review-ops'
          ? labels.navReviewOps
          : labels.navReviewCrawl
  const shellDescription =
    route === '/admin'
      ? labels.overviewDescription
      : route === '/admin/review-ops'
        ? labels.reviewOpsDescription
        : route === '/admin/review-crawl'
          ? labels.reviewCrawlDescription
          : labels.shellDescription

  return (
    <WorkspaceScaffold
      route={route}
      language={language}
      copy={copy}
      restaurants={restaurants}
      currentRestaurant={currentRestaurant}
      currentRestaurantAddress={currentRestaurant?.address ?? null}
      hasSource={hasSource}
      shellEyebrow={labels.shellEyebrow}
      shellTitle={shellTitle}
      shellDescription={shellDescription}
      shellTone="admin"
      roleDescriptor={roleDescriptor}
      navItems={[
        {
          routeId: '/admin',
          label: labels.navOverview,
          icon: 'storefront',
        },
        {
          routeId: '/admin/intake',
          label: labels.navIntake,
          icon: 'inventory_2',
        },
        {
          routeId: '/admin/review-ops',
          label: labels.navReviewOps,
          icon: 'sync_alt',
        },
        {
          routeId: '/admin/review-crawl',
          label: labels.navReviewCrawl,
          icon: 'travel_explore',
        },
      ]}
      statusPills={[
        {
          icon: 'inventory_2',
          label: `${pendingBatchCount} pending batch(es)`,
          tone: pendingBatchCount > 0 ? 'warning' : 'neutral',
        },
        {
          icon: 'verified',
          label: `${approvedItemCount} approved item(s)`,
          tone: approvedItemCount > 0 ? 'success' : 'neutral',
        },
      ]}
      onSelectRestaurant={onSelectRestaurant}
      onNavigate={onNavigate}
    >
      {overviewError ? <StatusMessage tone="error">{overviewError}</StatusMessage> : null}
      {detailError ? <StatusMessage tone="error">{detailError}</StatusMessage> : null}
      {overviewLoading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}
      {detailLoading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

      {!restaurants.length && !overviewLoading ? (
        <StatusMessage tone="error">No restaurant overview is available yet.</StatusMessage>
      ) : null}

      {route === '/admin' ? (
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
      ) : route === '/admin/intake' ? (
        <AdminIntakePanel
          language={language}
          restaurantId={currentRestaurantId}
          detail={restaurantDetail}
          onPublished={onDataChanged}
        />
      ) : route === '/admin/review-ops' ? (
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
    </WorkspaceScaffold>
  )
}
