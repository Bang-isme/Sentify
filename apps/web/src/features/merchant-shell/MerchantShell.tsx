import { useState } from 'react'
import { DashboardPanel } from '../../components/product/workspace/DashboardPanel'
import { OnboardingPanel } from '../../components/product/workspace/OnboardingPanel'
import { ReviewsPanel } from '../../components/product/workspace/ReviewsPanel'
import { SettingsPanel } from '../../components/product/workspace/SettingsPanel'
import { StatusMessage } from '../../components/product/workspace/shared'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { getRoleDescriptor } from '../access/restaurantAccess'
import { useDashboardData } from '../merchant-dashboard/useDashboardData'
import { useReviewEvidence } from '../merchant-reviews/useReviewEvidence'
import type { AppRoute, MerchantRoute } from '../app-shell/routes'
import { useRestaurantDetail } from '../restaurant-scope/useRestaurantDetail'
import { WorkspaceScaffold } from '../workspace/components/WorkspaceScaffold'
import type {
  CreateRestaurantInput,
  RestaurantMembership,
  ReviewsQuery,
  TrendPeriod,
  UpdateRestaurantInput,
} from '../../lib/api'

const DEFAULT_REVIEW_FILTERS: ReviewsQuery = {
  page: 1,
  limit: 10,
}

interface MerchantShellProps {
  route: MerchantRoute
  copy: ProductUiCopy['app']
  feedbackCopy: ProductUiCopy['feedback']
  language: string
  restaurants: RestaurantMembership[]
  selectedRestaurantId: string | null
  refreshKey: number
  createPending: boolean
  savePending: boolean
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: AppRoute) => void
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
  onSessionExpiry: (error: unknown) => boolean
}

export function MerchantShell({
  route,
  copy,
  feedbackCopy,
  language,
  restaurants,
  selectedRestaurantId,
  refreshKey,
  createPending,
  savePending,
  onSelectRestaurant,
  onNavigate,
  onCreateRestaurant,
  onSaveRestaurant,
  onSessionExpiry,
}: MerchantShellProps) {
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('week')
  const [reviewFilters, setReviewFilters] = useState<ReviewsQuery>(DEFAULT_REVIEW_FILTERS)
  const hasRestaurants = restaurants.length > 0
  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? restaurants[0] ?? null

  const restaurantDetail = useRestaurantDetail({
    enabled: hasRestaurants,
    restaurantId: selectedRestaurantId,
    refreshKey,
    fallbackMessage: feedbackCopy.errors.loadRestaurant,
    onSessionExpiry,
  })

  const dashboard = useDashboardData({
    enabled: route === '/app' && hasRestaurants,
    restaurantId: selectedRestaurantId,
    refreshKey,
    trendPeriod,
    fallbackMessage: feedbackCopy.errors.loadDashboard,
    onSessionExpiry,
  })

  const reviews = useReviewEvidence({
    enabled: route === '/app/reviews' && hasRestaurants,
    restaurantId: selectedRestaurantId,
    refreshKey,
    query: reviewFilters,
    fallbackMessage: feedbackCopy.errors.loadReviews,
    onSessionExpiry,
  })

  if (!hasRestaurants) {
    return (
      <div className="grid gap-6">
        {restaurantDetail.error ? <StatusMessage tone="error">{restaurantDetail.error}</StatusMessage> : null}
        <OnboardingPanel
          copy={copy}
          createPending={createPending}
          onCreateRestaurant={onCreateRestaurant}
        />
      </div>
    )
  }

  const hasSource = Boolean(restaurantDetail.detail?.googleMapUrl ?? currentRestaurant?.googleMapUrl)
  const roleDescriptor = getRoleDescriptor('USER', language)

  return (
    <WorkspaceScaffold
      route={route}
      language={language}
      copy={copy}
      restaurants={restaurants}
      currentRestaurant={currentRestaurant}
      currentRestaurantAddress={restaurantDetail.detail?.address?.trim() ?? null}
      hasSource={hasSource}
      shellEyebrow={copy.operationalPrompt}
      shellTitle={copy.shellTitle}
      shellDescription={copy.shellDescription}
      shellTone="user"
      roleDescriptor={roleDescriptor}
      navItems={[
        {
          routeId: '/app',
          label: copy.navDashboard,
          icon: 'space_dashboard',
        },
        {
          routeId: '/app/reviews',
          label: copy.navReviews,
          icon: 'rate_review',
        },
        {
          routeId: '/app/settings',
          label: copy.navSettings,
          icon: 'settings',
        },
      ]}
      statusPills={[
        {
          icon: 'verified_user',
          label: copy.protectedAccess,
        },
        {
          icon: 'lan',
          label: copy.restaurantScoped,
        },
      ]}
      onSelectRestaurant={onSelectRestaurant}
      onNavigate={onNavigate}
    >
      {restaurantDetail.error ? <StatusMessage tone="error">{restaurantDetail.error}</StatusMessage> : null}
      {restaurantDetail.loading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

      {route === '/app' ? (
        <DashboardPanel
          copy={copy}
          detail={restaurantDetail.detail}
          dashboard={dashboard.dashboard}
          loading={dashboard.loading}
          error={dashboard.error}
          trendPeriod={trendPeriod}
          language={language}
          onTrendPeriodChange={setTrendPeriod}
          onNavigate={onNavigate}
        />
      ) : route === '/app/reviews' ? (
        <ReviewsPanel
          copy={copy}
          detail={restaurantDetail.detail}
          reviews={reviews.reviews}
          loading={reviews.loading}
          error={reviews.error}
          reviewFilters={reviewFilters}
          language={language}
          onApplyReviewFilters={setReviewFilters}
          onClearReviewFilters={() => setReviewFilters(DEFAULT_REVIEW_FILTERS)}
          onReviewPageChange={(page) =>
            setReviewFilters((current) => ({
              ...current,
              page: Math.max(page, 1),
            }))
          }
        />
      ) : (
        <SettingsPanel
          copy={copy}
          detail={restaurantDetail.detail}
          pending={savePending}
          createPending={createPending}
          onCreateRestaurant={onCreateRestaurant}
          onSaveRestaurant={onSaveRestaurant}
        />
      )}
    </WorkspaceScaffold>
  )
}
