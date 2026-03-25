import type { ReactNode } from 'react'
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
  const hasMultipleRestaurants = restaurants.length > 1
  const activeNavItem = navItems.find((item) => item.routeId === route) ?? navItems[0] ?? null
  const labels = language.startsWith('vi')
    ? {
        activeFlow: 'Luong thao tac hien tai',
        currentRole: 'Vai tro hien tai',
        step: 'Buoc',
      }
    : language.startsWith('ja')
      ? {
          activeFlow: 'Current flow',
          currentRole: 'Current role',
          step: 'Step',
        }
      : {
          activeFlow: 'Active flow',
          currentRole: 'Current role',
          step: 'Step',
        }
  const toneClasses =
    shellTone === 'admin'
      ? {
          shell: 'border-primary/20 bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(18,18,16,0.88))] dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.1),rgba(15,12,8,0.92))]',
          accent:
            'border-primary/25 bg-primary/12 text-primary dark:border-primary/20 dark:bg-primary/12 dark:text-primary',
        }
      : {
          shell: 'border-border-light/70 bg-[linear-gradient(135deg,rgba(247,250,248,0.98),rgba(230,241,237,0.9))] dark:border-border-dark/70 dark:bg-[linear-gradient(135deg,rgba(23,26,24,0.94),rgba(14,16,15,0.92))]',
          accent:
            'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200',
        }

  return (
    <main id="main-content" className="min-h-screen bg-bg-light pb-16 pt-24 dark:bg-bg-dark sm:pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:px-10">
        <div className="grid gap-6">
          <section
            className={`overflow-hidden rounded-[2rem] border p-5 shadow-[0_22px_80px_-42px_rgba(0,0,0,0.42)] backdrop-blur sm:p-6 ${toneClasses.shell}`}
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
              <div className="grid gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    <span className="size-2 rounded-full bg-primary"></span>
                    {shellEyebrow}
                  </span>
                  {activeNavItem ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-border-light/70 bg-surface-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:border-border-dark dark:bg-bg-dark/55 dark:text-text-silver-dark">
                      <span className="material-symbols-outlined text-[15px]">
                        {activeNavItem.icon}
                      </span>
                      {activeNavItem.label}
                    </span>
                  ) : null}
                </div>

                <div className="max-w-4xl">
                  <h1 className="text-[2rem] font-black tracking-tight text-text-charcoal dark:text-white sm:text-[2.4rem]">
                    {shellTitle}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-text-silver-light dark:text-text-silver-dark">
                    {shellDescription}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="rounded-[1.5rem] border border-border-light/70 bg-surface-white/78 p-4 shadow-[0_16px_48px_-34px_rgba(0,0,0,0.28)] dark:border-border-dark dark:bg-surface-dark/72">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.activeFlow}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {navItems.map((item, index) => {
                        const isActive = item.routeId === route

                        return (
                          <button
                            key={item.routeId}
                            type="button"
                            className={`group rounded-[1.3rem] border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] ${
                              isActive
                                ? 'border-primary/35 bg-primary/12'
                                : 'border-border-light/70 bg-bg-light/72 hover:border-primary/25 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/50'
                            }`}
                            onClick={() => onNavigate(item.routeId)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex size-9 items-center justify-center rounded-2xl border border-primary/18 bg-primary/10 text-primary">
                                <span className="material-symbols-outlined text-[18px]">
                                  {item.icon}
                                </span>
                              </span>
                              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
                                {labels.step} {index + 1}
                              </span>
                            </div>
                            <div className="mt-4 text-sm font-semibold text-text-charcoal dark:text-white">
                              {item.label}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-border-light/70 bg-surface-white/78 p-4 shadow-[0_16px_48px_-34px_rgba(0,0,0,0.28)] dark:border-border-dark dark:bg-surface-dark/72">
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                      {labels.currentRole}
                    </div>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${toneClasses.accent}`}>
                      {roleDescriptor.label}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                      {roleDescriptor.description}
                    </p>
                  </div>
                </div>
              </div>

              <aside className="grid gap-4 self-start">
                <section className="rounded-[1.7rem] border border-border-light/70 bg-surface-white/84 p-5 shadow-[0_18px_60px_-38px_rgba(0,0,0,0.4)] dark:border-border-dark dark:bg-surface-dark/78">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                        {copy.currentRestaurant}
                      </div>
                      {!hasMultipleRestaurants ? (
                        <h2 className="mt-3 text-[1.55rem] font-black tracking-tight text-text-charcoal dark:text-white">
                          {currentRestaurant?.name ?? copy.anonymousGuest}
                        </h2>
                      ) : null}
                    </div>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[20px]">storefront</span>
                    </span>
                  </div>

                  <div className="mt-4">
                    {hasMultipleRestaurants ? (
                      <RestaurantSwitcher
                        copy={copy}
                        restaurants={restaurants}
                        currentRestaurant={currentRestaurant}
                        onSelectRestaurant={onSelectRestaurant}
                        showLabel={false}
                        compact
                      />
                    ) : (
                      <p className="text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
                        {currentRestaurantAddress || shellDescription}
                      </p>
                    )}
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
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        rate_review
                      </span>
                      {formatNumber(currentRestaurant?.totalReviews ?? 0, language)} {copy.navReviews}
                    </span>
                  </div>
                </section>

                <section className="rounded-[1.7rem] border border-border-light/70 bg-surface-white/84 p-5 shadow-[0_18px_60px_-38px_rgba(0,0,0,0.4)] dark:border-border-dark dark:bg-surface-dark/78">
                  <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
                    {copy.connectionHealth}
                  </div>
                  <div className="grid gap-2">
                    {statusPills.map((pill) => (
                      <SidebarStatusPill
                        key={`${pill.icon}-${pill.label}`}
                        icon={pill.icon}
                        label={pill.label}
                        tone={pill.tone}
                      />
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </section>

          <section className="grid gap-6">{children}</section>
        </div>
      </div>
    </main>
  )
}
