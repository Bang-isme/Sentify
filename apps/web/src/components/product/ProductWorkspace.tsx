import { useEffect, useRef, useState } from 'react'
import { AdminIntakePanel } from '../../features/admin-intake/components/AdminIntakePanel'
import { getAdminIntakeLabels } from '../../features/admin-intake/adminIntakeLabels'
import type {
  ComplaintKeyword,
  CreateRestaurantInput,
  InsightSummary,
  RestaurantDetail,
  RestaurantMembership,
  ReviewListResponse,
  ReviewsQuery,
  SentimentBreakdownRow,
  TrendPeriod,
  TrendPoint,
  UpdateRestaurantInput,
} from '../../lib/api'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { useLanguage } from '../../contexts/languageContext'
import { DashboardPanel } from './workspace/DashboardPanel'
import { OnboardingPanel } from './workspace/OnboardingPanel'
import { ReviewsPanel } from './workspace/ReviewsPanel'
import { SettingsPanel } from './workspace/SettingsPanel'
import { SidebarStatusPill, StatusMessage } from './workspace/shared'
import { formatNumber } from './workspace/shared-utils'

interface ProductWorkspaceProps {
  route: '/app' | '/app/reviews' | '/app/settings' | '/app/admin'
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  selectedRestaurantId: string | null
  selectedRestaurantDetail: RestaurantDetail | null
  restaurantLoading: boolean
  restaurantError: string | null
  dashboard: {
    kpi: InsightSummary | null
    sentiment: SentimentBreakdownRow[]
    trend: TrendPoint[]
    complaints: ComplaintKeyword[]
  }
  dashboardLoading: boolean
  dashboardError: string | null
  trendPeriod: TrendPeriod
  onTrendPeriodChange: (period: TrendPeriod) => void
  savePending: boolean
  createPending: boolean
  reviews: ReviewListResponse | null
  reviewsLoading: boolean
  reviewsError: string | null
  reviewFilters: ReviewsQuery
  onApplyReviewFilters: (filters: ReviewsQuery) => void
  onClearReviewFilters: () => void
  onReviewPageChange: (page: number) => void
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: '/app' | '/app/reviews' | '/app/settings' | '/app/admin') => void
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
  onAdminDataPublished: () => void
}

function RestaurantSwitcher({
  copy,
  restaurants,
  currentRestaurant,
  onSelectRestaurant,
  showLabel = true,
  compact = false,
}: {
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  currentRestaurant: RestaurantMembership | null
  onSelectRestaurant: (restaurantId: string) => void
  showLabel?: boolean
  compact?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!currentRestaurant) {
    return null
  }

  if (restaurants.length <= 1) {
    return (
      <div>
        {showLabel ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherLabel}
            </div>
            <div className="mt-3 text-base font-bold text-text-charcoal dark:text-white">
              {currentRestaurant.name}
            </div>
          </>
        ) : null}
        <div className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherReadonly}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {showLabel ? (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherLabel}
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-[1.35rem] border border-border-light/80 bg-bg-light/75 px-4 text-left transition hover:border-primary/35 hover:bg-primary/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-border-dark dark:bg-bg-dark/55 ${
          compact ? 'py-3.5' : 'py-4'
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div>
          <div className="text-base font-bold text-text-charcoal dark:text-white">
            {currentRestaurant.name}
          </div>
          {!compact ? (
            <div className="mt-1 text-sm text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherHint}
            </div>
          ) : null}
        </div>
        <span
          className={`material-symbols-outlined text-base text-text-silver-light transition-transform duration-200 dark:text-text-silver-dark ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      <div
        className={`grid overflow-hidden rounded-[1.3rem] border border-border-light/80 bg-surface-white/96 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark dark:bg-surface-dark/96 ${
          isOpen
            ? 'mt-3 max-h-80 p-2 opacity-100'
            : 'pointer-events-none mt-0 max-h-0 p-0 opacity-0'
        }`}
        role="listbox"
        aria-label={copy.restaurantSwitcherLabel}
      >
        {restaurants.map((restaurant) => {
          const isActive = restaurant.id === currentRestaurant.id

          return (
            <button
              key={restaurant.id}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-charcoal hover:bg-primary/6 dark:text-white dark:hover:bg-white/5'
              }`}
              onClick={() => {
                onSelectRestaurant(restaurant.id)
                setIsOpen(false)
              }}
            >
              <span className="font-semibold">{restaurant.name}</span>
              {isActive ? <span className="material-symbols-outlined text-base">check</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ProductWorkspace({
  route,
  copy,
  restaurants,
  selectedRestaurantId,
  selectedRestaurantDetail,
  restaurantLoading,
  restaurantError,
  dashboard,
  dashboardLoading,
  dashboardError,
  trendPeriod,
  onTrendPeriodChange,
  savePending,
  createPending,
  reviews,
  reviewsLoading,
  reviewsError,
  reviewFilters,
  onApplyReviewFilters,
  onClearReviewFilters,
  onReviewPageChange,
  onSelectRestaurant,
  onNavigate,
  onCreateRestaurant,
  onSaveRestaurant,
  onAdminDataPublished,
}: ProductWorkspaceProps) {
  const { language } = useLanguage()
  const adminLabels = getAdminIntakeLabels(language)
  const hasRestaurants = restaurants.length > 0
  const currentRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? restaurants[0] ?? null
  const hasSource = Boolean(selectedRestaurantDetail?.googleMapUrl ?? currentRestaurant?.googleMapUrl)
  const currentRestaurantAddress = selectedRestaurantDetail?.address?.trim()
  const hasMultipleRestaurants = restaurants.length > 1
  const navItems = [
    {
      routeId: '/app' as const,
      label: copy.navDashboard,
      icon: 'space_dashboard',
    },
    {
      routeId: '/app/reviews' as const,
      label: copy.navReviews,
      icon: 'rate_review',
    },
    {
      routeId: '/app/settings' as const,
      label: copy.navSettings,
      icon: 'settings',
    },
    {
      routeId: '/app/admin' as const,
      label: adminLabels.nav,
      icon: 'admin_panel_settings',
    },
  ]

  return (
    <main id="main-content" className="min-h-screen bg-bg-light pb-16 pt-24 dark:bg-bg-dark sm:pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-10">
        {!hasRestaurants ? (
          <div className="grid gap-6">
            {restaurantError ? <StatusMessage tone="error">{restaurantError}</StatusMessage> : null}
            <OnboardingPanel
              copy={copy}
              createPending={createPending}
              onCreateRestaurant={onCreateRestaurant}
            />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[264px_minmax(0,1fr)]">
            <aside className="hidden xl:grid xl:gap-4 xl:self-start xl:sticky xl:top-28">
              <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/90 p-4 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/84">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                  {copy.operationalPrompt}
                </div>
                <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                  {copy.shellDescription}
                </p>
                <div className="mt-4 grid gap-2">
                  {navItems.map((item) => {
                    const isActive = route === item.routeId

                    return (
                      <button
                        key={item.routeId}
                        type="button"
                        className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-primary/35 bg-primary/12 shadow-[0_12px_24px_-18px_rgba(212,175,55,0.7)]'
                            : 'border-border-light/70 bg-bg-light/70 hover:border-primary/35 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
                        }`}
                        onClick={() => onNavigate(item.routeId)}
                      >
                        <span className="material-symbols-outlined text-[20px] text-primary">
                          {item.icon}
                        </span>
                        <span className="text-sm font-semibold text-text-charcoal dark:text-white">
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border-light/70 bg-surface-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/84">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                      {copy.currentRestaurant}
                    </div>
                    {hasMultipleRestaurants ? (
                      <div className="mt-4">
                        <RestaurantSwitcher
                          copy={copy}
                          restaurants={restaurants}
                          currentRestaurant={currentRestaurant}
                          onSelectRestaurant={onSelectRestaurant}
                          showLabel={false}
                          compact
                        />
                      </div>
                    ) : (
                      <>
                        <h2 className="mt-3 text-[1.45rem] font-black tracking-tight text-text-charcoal dark:text-white">
                          {currentRestaurant?.name ?? copy.anonymousGuest}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                          {currentRestaurantAddress || copy.shellDescription}
                        </p>
                      </>
                    )}
                  </div>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[20px]">storefront</span>
                  </span>
                </div>

                {hasMultipleRestaurants && currentRestaurantAddress ? (
                  <p className="mt-4 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                    {currentRestaurantAddress}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/75 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      {hasSource ? 'task_alt' : 'warning'}
                    </span>
                    {hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/75 px-3 py-1.5 text-xs font-semibold text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white">
                    <span className="material-symbols-outlined text-[16px] text-primary">rate_review</span>
                    {formatNumber(currentRestaurant?.totalReviews ?? 0, language)} {copy.navReviews}
                  </span>
                </div>

                <div className="mt-5 border-t border-border-light/70 pt-5 dark:border-border-dark/80">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                    {copy.connectionHealth}
                  </div>
                  <div className="grid gap-2">
                    <SidebarStatusPill icon="verified_user" label={copy.protectedAccess} />
                    <SidebarStatusPill icon="lan" label={copy.restaurantScoped} />
                  </div>
                </div>
              </section>
            </aside>

            <section className="grid gap-6">
              <div className="grid gap-4 xl:hidden">
                <section className="rounded-[1.5rem] border border-border-light/70 bg-surface-white/90 p-4 shadow-[0_16px_50px_-36px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/84">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                        {copy.currentRestaurant}
                      </div>
                      {!hasMultipleRestaurants ? (
                        <div className="mt-2 text-base font-bold text-text-charcoal dark:text-white">
                          {currentRestaurant?.name ?? copy.anonymousGuest}
                        </div>
                      ) : null}
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[18px]">storefront</span>
                    </span>
                  </div>

                  {hasMultipleRestaurants ? (
                    <RestaurantSwitcher
                      copy={copy}
                      restaurants={restaurants}
                      currentRestaurant={currentRestaurant}
                      onSelectRestaurant={onSelectRestaurant}
                      showLabel={false}
                      compact
                    />
                  ) : null}

                  {currentRestaurantAddress ? (
                    <p className="mt-3 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {currentRestaurantAddress}
                    </p>
                  ) : null}

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {navItems.map((item) => {
                      const isActive = route === item.routeId

                      return (
                        <button
                          key={item.routeId}
                          type="button"
                          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                            isActive
                              ? 'border-primary/35 bg-primary/12 text-primary'
                              : 'border-border-light/70 bg-bg-light/70 text-text-charcoal hover:border-primary/35 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55 dark:text-white'
                          }`}
                          onClick={() => onNavigate(item.routeId)}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <SidebarStatusPill
                      icon={hasSource ? 'task_alt' : 'warning'}
                      label={hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration}
                      tone={hasSource ? 'success' : 'warning'}
                    />
                    <SidebarStatusPill icon="verified_user" label={copy.protectedAccess} />
                  </div>
                </section>
              </div>

              {restaurantError ? <StatusMessage tone="error">{restaurantError}</StatusMessage> : null}
              {restaurantLoading ? <StatusMessage>{copy.loadingRestaurant}</StatusMessage> : null}

              {route === '/app' ? (
                <DashboardPanel
                  copy={copy}
                  detail={selectedRestaurantDetail}
                  dashboard={dashboard}
                  loading={dashboardLoading}
                  error={dashboardError}
                  trendPeriod={trendPeriod}
                  language={language}
                  onTrendPeriodChange={onTrendPeriodChange}
                  onNavigate={onNavigate}
                />
              ) : route === '/app/reviews' ? (
                <ReviewsPanel
                  copy={copy}
                  detail={selectedRestaurantDetail}
                  reviews={reviews}
                  loading={reviewsLoading}
                  error={reviewsError}
                  reviewFilters={reviewFilters}
                  language={language}
                  onApplyReviewFilters={onApplyReviewFilters}
                  onClearReviewFilters={onClearReviewFilters}
                  onReviewPageChange={onReviewPageChange}
                />
              ) : route === '/app/settings' ? (
                <SettingsPanel
                  copy={copy}
                  detail={selectedRestaurantDetail}
                  pending={savePending}
                  createPending={createPending}
                  onCreateRestaurant={onCreateRestaurant}
                  onSaveRestaurant={onSaveRestaurant}
                />
              ) : (
                <AdminIntakePanel
                  language={language}
                  restaurantId={selectedRestaurantId}
                  detail={selectedRestaurantDetail}
                  onPublished={onAdminDataPublished}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
