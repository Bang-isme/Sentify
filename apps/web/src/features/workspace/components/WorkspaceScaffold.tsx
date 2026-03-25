import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProductUiCopy } from '../../../content/productUiCopy'
import type { RestaurantMembership } from '../../../lib/api'
import { SidebarStatusPill } from '../../../components/product/workspace/shared'
import { formatNumber } from '../../../components/product/workspace/shared-utils'
import { RestaurantSwitcher } from './RestaurantSwitcher'
import type { UserRoleDescriptor } from '../../access/restaurantAccess'

export interface WorkspaceNavItem<RouteId extends string> {
  routeId: RouteId
  label: string
  icon: string
}

interface WorkspaceScaffoldProps<RouteId extends string> {
  route: RouteId
  language: string
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  currentRestaurant: RestaurantMembership | null
  currentRestaurantAddress: string | null
  hasSource: boolean
  shellEyebrow: string
  shellTitle: string
  shellDescription: string
  shellTone?: 'user' | 'admin'
  roleDescriptor: UserRoleDescriptor
  navItems: WorkspaceNavItem<RouteId>[]
  statusPills: Array<{
    icon: string
    label: string
    tone?: 'neutral' | 'success' | 'warning'
  }>
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: RouteId) => void
  children: ReactNode
}

function getScaffoldLabels(language: string) {
  if (language.startsWith('vi')) {
    return {
      activeFlow: 'Luong hien tai',
      currentRole: 'Vai tro',
      navigation: 'Dieu huong',
      openNavigation: 'Mo dieu huong',
      closeNavigation: 'Dong dieu huong',
      collapseSidebar: 'Thu gon sidebar',
      expandSidebar: 'Mo rong sidebar',
      currentRestaurant: 'Nha hang hien tai',
      smartRailHint: 'Sidebar co the thu gon de mo rong vung noi dung.',
    }
  }

  if (language.startsWith('ja')) {
    return {
      activeFlow: 'Current flow',
      currentRole: 'Role',
      navigation: 'Navigation',
      openNavigation: 'Open navigation',
      closeNavigation: 'Close navigation',
      collapseSidebar: 'Collapse sidebar',
      expandSidebar: 'Expand sidebar',
      currentRestaurant: 'Current restaurant',
      smartRailHint: 'Collapse the rail to free more workspace.',
    }
  }

  return {
    activeFlow: 'Current flow',
    currentRole: 'Role',
    navigation: 'Navigation',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    currentRestaurant: 'Current restaurant',
    smartRailHint: 'Collapse the rail to free more workspace.',
  }
}

function getSidebarStorageKey(shellTone: 'user' | 'admin') {
  return `sentify-sidebar-${shellTone}`
}

export function WorkspaceScaffold<RouteId extends string>({
  route,
  language,
  copy,
  restaurants,
  currentRestaurant,
  currentRestaurantAddress,
  hasSource,
  shellEyebrow,
  shellTitle,
  shellDescription,
  shellTone = 'user',
  roleDescriptor,
  navItems,
  statusPills,
  onSelectRestaurant,
  onNavigate,
  children,
}: WorkspaceScaffoldProps<RouteId>) {
  const labels = useMemo(() => getScaffoldLabels(language), [language])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const hasMultipleRestaurants = restaurants.length > 1
  const activeNavItem = navItems.find((item) => item.routeId === route) ?? navItems[0] ?? null
  const sidebarStorageKey = useMemo(() => getSidebarStorageKey(shellTone), [shellTone])

  useEffect(() => {
    const savedState = window.localStorage.getItem(sidebarStorageKey)

    if (savedState === 'collapsed' || savedState === 'expanded') {
      setIsSidebarCollapsed(savedState === 'collapsed')
      return
    }

    setIsSidebarCollapsed(window.innerWidth < 1440)
  }, [sidebarStorageKey])

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, isSidebarCollapsed ? 'collapsed' : 'expanded')
  }, [isSidebarCollapsed, sidebarStorageKey])

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileSidebarOpen])

  const toneClasses =
    shellTone === 'admin'
      ? {
          surface:
            'border-primary/16 bg-[linear-gradient(180deg,rgba(35,31,20,0.96),rgba(24,22,16,0.94))] dark:bg-[linear-gradient(180deg,rgba(32,28,19,0.98),rgba(18,16,11,0.98))]',
          mutedSurface:
            'border-primary/15 bg-primary/[0.04] dark:border-primary/12 dark:bg-primary/[0.05]',
          chip: 'border-primary/22 bg-primary/12 text-primary',
          navActive: 'border-primary/26 bg-primary/12 text-white dark:text-primary',
          navIdle:
            'border-transparent bg-transparent text-text-silver-dark hover:border-primary/14 hover:bg-primary/6 hover:text-white',
        }
      : {
          surface:
            'border-border-light/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,242,0.9))] dark:border-border-dark/70 dark:bg-[linear-gradient(180deg,rgba(24,27,25,0.96),rgba(16,18,17,0.94))]',
          mutedSurface:
            'border-emerald-300/18 bg-emerald-500/[0.05] dark:border-emerald-400/14 dark:bg-emerald-500/[0.06]',
          chip:
            'border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200',
          navActive:
            'border-emerald-300/26 bg-emerald-500/10 text-text-charcoal dark:border-emerald-400/22 dark:bg-emerald-500/12 dark:text-white',
          navIdle:
            'border-transparent bg-transparent text-text-silver-light hover:border-emerald-300/18 hover:bg-emerald-500/6 hover:text-text-charcoal dark:text-text-silver-dark dark:hover:text-white',
        }

  const desktopRailWidth = isSidebarCollapsed ? 'lg:w-[96px]' : 'lg:w-[302px]'
  const sidebarCardPadding = isSidebarCollapsed ? 'px-3 py-3' : 'px-4 py-4'
  const handleNavigate = (nextRoute: RouteId) => {
    setIsMobileSidebarOpen(false)
    onNavigate(nextRoute)
  }

  const handleRestaurantSelect = (restaurantId: string) => {
    setIsMobileSidebarOpen(false)
    onSelectRestaurant(restaurantId)
  }

  return (
    <main className="min-h-screen bg-bg-light pb-6 pt-[4.7rem] dark:bg-bg-dark sm:pt-[5rem]">
      <div className="w-full px-2 sm:px-3 xl:px-4 2xl:px-5">
        <div className="grid items-start gap-3 lg:grid-cols-[auto_minmax(0,1fr)] xl:gap-4">
          <div
            className={`fixed inset-0 z-40 bg-bg-dark/45 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
              isMobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isMobileSidebarOpen}
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[min(320px,86vw)] flex-col gap-3 border-r border-border-dark/70 bg-[#16140f]/96 p-3 text-white shadow-[0_24px_70px_-28px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-22 lg:z-0 lg:h-[calc(100vh-6.5rem)] lg:translate-x-0 lg:rounded-[1.7rem] lg:border lg:border-border-dark/80 lg:p-3 lg:shadow-[0_20px_60px_-34px_rgba(0,0,0,0.52)] ${desktopRailWidth} ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${toneClasses.surface}`}
            aria-label={labels.navigation}
          >
            <div className={`app-shell-panel rounded-[1.45rem] border ${sidebarCardPadding} ${toneClasses.mutedSurface}`}>
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[20px]">
                    {shellTone === 'admin' ? 'shield_person' : 'dashboard_customize'}
                  </span>
                </div>
                {!isSidebarCollapsed ? (
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-dark">
                      {shellEyebrow}
                    </div>
                    <div className="mt-2 text-base font-bold tracking-tight text-white">
                      {roleDescriptor.label}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-text-silver-dark">
                      {labels.smartRailHint}
                    </p>
                  </div>
                ) : null}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-2xl border border-border-dark/80 bg-bg-dark/55 text-text-silver-dark transition hover:border-primary/22 hover:text-primary lg:hidden"
                    aria-label={labels.closeNavigation}
                    onClick={() => setIsMobileSidebarOpen(false)}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                  <button
                    type="button"
                    className="hidden size-9 items-center justify-center rounded-2xl border border-border-dark/80 bg-bg-dark/55 text-text-silver-dark transition hover:border-primary/22 hover:text-primary lg:inline-flex"
                    aria-label={isSidebarCollapsed ? labels.expandSidebar : labels.collapseSidebar}
                    onClick={() => setIsSidebarCollapsed((current) => !current)}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <nav className={`app-shell-panel rounded-[1.45rem] border ${sidebarCardPadding} ${toneClasses.mutedSurface}`}>
              {!isSidebarCollapsed ? (
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-dark">
                  {labels.navigation}
                </div>
              ) : null}
              <div className="grid gap-2">
                {navItems.map((item, index) => {
                  const isActive = item.routeId === route

                  return (
                    <button
                      key={item.routeId}
                      type="button"
                      title={isSidebarCollapsed ? item.label : undefined}
                      aria-label={`Step ${index + 1} ${item.label}`}
                      className={`app-hover-lift pressable flex items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition ${
                        isActive ? toneClasses.navActive : toneClasses.navIdle
                      }`}
                      onClick={() => handleNavigate(item.routeId)}
                    >
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/18 bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      </span>
                      {!isSidebarCollapsed ? (
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold leading-5">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-dark">
                            Step {index + 1}
                          </span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </nav>

            <div className={`app-shell-panel rounded-[1.45rem] border ${sidebarCardPadding} ${toneClasses.mutedSurface}`}>
              {!isSidebarCollapsed ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${toneClasses.chip}`}>
                      {labels.currentRole}
                    </span>
                    {activeNavItem ? (
                      <span className="inline-flex rounded-full border border-border-dark/80 bg-bg-dark/55 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-dark">
                        {activeNavItem.label}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-silver-dark">{roleDescriptor.description}</p>
                </>
              ) : (
                <div className="grid place-items-center">
                  <span className={`inline-flex size-10 items-center justify-center rounded-2xl border ${toneClasses.chip}`} title={roleDescriptor.label}>
                    <span className="material-symbols-outlined text-[18px]">
                      {shellTone === 'admin' ? 'admin_panel_settings' : 'person'}
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className={`app-shell-panel rounded-[1.45rem] border ${sidebarCardPadding} ${toneClasses.mutedSurface}`}>
              {!isSidebarCollapsed ? (
                <>
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-dark">
                    {labels.currentRestaurant}
                  </div>
                  {hasMultipleRestaurants ? (
                    <RestaurantSwitcher
                      copy={copy}
                      restaurants={restaurants}
                      currentRestaurant={currentRestaurant}
                      onSelectRestaurant={handleRestaurantSelect}
                      showLabel={false}
                      compact
                    />
                  ) : (
                    <div className="rounded-[1.2rem] border border-border-dark/80 bg-bg-dark/55 px-4 py-3">
                      <div className="text-sm font-semibold text-white">
                        {currentRestaurant?.name ?? copy.anonymousGuest}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-text-silver-dark">
                        {currentRestaurantAddress || copy.restaurantSwitcherReadonly}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border-dark/80 bg-bg-dark/55 px-3 py-2 text-xs font-semibold text-white">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        {hasSource ? 'task_alt' : 'warning'}
                      </span>
                      {hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border-dark/80 bg-bg-dark/55 px-3 py-2 text-xs font-semibold text-white">
                      <span className="material-symbols-outlined text-[16px] text-primary">rate_review</span>
                      {formatNumber(currentRestaurant?.totalReviews ?? 0, language)} {copy.navReviews}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <button
                    type="button"
                    title={currentRestaurant?.name ?? copy.currentRestaurant}
                    className="inline-flex size-10 items-center justify-center rounded-2xl border border-border-dark/80 bg-bg-dark/55 text-primary transition hover:border-primary/22 hover:bg-primary/10"
                    onClick={() => setIsSidebarCollapsed(false)}
                  >
                    <span className="material-symbols-outlined text-[18px]">storefront</span>
                  </button>
                  <div
                    className="inline-flex size-10 items-center justify-center rounded-2xl border border-border-dark/80 bg-bg-dark/55 text-white"
                    title={`${formatNumber(currentRestaurant?.totalReviews ?? 0, language)} ${copy.navReviews}`}
                  >
                    <span className="text-[11px] font-bold">{formatNumber(currentRestaurant?.totalReviews ?? 0, language)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={`app-shell-panel mt-auto rounded-[1.45rem] border ${sidebarCardPadding} ${toneClasses.mutedSurface}`}>
              {!isSidebarCollapsed ? (
                <>
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-dark">
                    {copy.connectionHealth}
                  </div>
                  <div className="grid gap-2">
                    {statusPills.map((pill) => (
                      <SidebarStatusPill
                        key={`${pill.icon}-${pill.label}`}
                        icon={pill.icon}
                        label={pill.label}
                        tone={pill.tone}
                        compact
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  {statusPills.slice(0, 2).map((pill) => (
                    <div
                      key={`${pill.icon}-${pill.label}`}
                      title={pill.label}
                      className="inline-flex size-10 items-center justify-center rounded-2xl border border-border-dark/80 bg-bg-dark/55 text-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">{pill.icon}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-3">
            <section
              className={`app-shell-panel rounded-[1.3rem] border px-3 py-3 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.42)] backdrop-blur sm:px-4 ${toneClasses.surface}`}
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex size-10 items-center justify-center rounded-2xl border border-border-light/70 bg-surface-white/78 text-text-charcoal transition hover:border-primary/30 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white lg:hidden"
                      aria-label={labels.openNavigation}
                      onClick={() => setIsMobileSidebarOpen(true)}
                    >
                      <span className="material-symbols-outlined text-[18px]">menu</span>
                    </button>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${toneClasses.chip}`}
                    >
                      <span className="size-2 rounded-full bg-current"></span>
                      {shellEyebrow}
                    </span>
                    {activeNavItem ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-surface-white/72 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:border-border-dark dark:bg-bg-dark/55 dark:text-text-silver-dark">
                        <span className="material-symbols-outlined text-[15px]">
                          {activeNavItem.icon}
                        </span>
                        {activeNavItem.label}
                      </span>
                    ) : null}
                    <span className="hidden truncate text-sm font-semibold text-text-charcoal/85 dark:text-white/90 2xl:inline">
                      {shellTitle}
                    </span>
                  </div>
                  <div className="mt-2 hidden max-w-4xl text-[13px] leading-5 text-text-silver-light dark:text-text-silver-dark 2xl:block">
                    {shellDescription}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
                  <div className="rounded-[1.15rem] border border-border-light/70 bg-surface-white/72 px-3 py-2.5 dark:border-border-dark dark:bg-bg-dark/52">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.currentRole}
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-text-charcoal dark:text-white">
                      {roleDescriptor.label}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-border-light/70 bg-surface-white/72 px-3 py-2.5 dark:border-border-dark dark:bg-bg-dark/52">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.currentRestaurant}
                    </div>
                    <div className="mt-1.5 truncate text-sm font-semibold text-text-charcoal dark:text-white">
                      {currentRestaurant?.name ?? copy.anonymousGuest}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-border-light/70 bg-surface-white/72 px-3 py-2.5 dark:border-border-dark dark:bg-bg-dark/52">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.activeFlow}
                    </div>
                    <div className="mt-1.5 truncate text-sm font-semibold text-text-charcoal dark:text-white">
                      {activeNavItem?.label ?? shellEyebrow}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 xl:gap-4">{children}</section>
          </div>
        </div>
      </div>
    </main>
  )
}
