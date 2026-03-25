import { useEffect, useMemo, useState } from 'react'
import type { MerchantHubRoute, MerchantHubShellContext } from './merchantHubTypes'
import { merchantHubCopy } from './merchantHubCopy'
import { MerchantHubBadge } from './merchantHubUi'

const MERCHANT_NAV: Array<{
  route: MerchantHubRoute
  label: string
  icon: string
  description: string
}> = [
  { route: 'home', label: merchantHubCopy.nav.home, icon: 'space_dashboard', description: 'At a glance' },
  { route: 'reviews', label: merchantHubCopy.nav.reviews, icon: 'rate_review', description: 'Evidence board' },
  { route: 'actions', label: merchantHubCopy.nav.actions, icon: 'target', description: 'Fix first' },
  { route: 'settings', label: merchantHubCopy.nav.settings, icon: 'settings', description: 'Profile and source' },
]

function getShellStorageKey() {
  return 'sentify-merchant-hub-rail'
}

function MerchantRailButton({
  active,
  collapsed,
  label,
  description,
  icon,
  onClick,
}: {
  active: boolean
  collapsed: boolean
  label: string
  description: string
  icon: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 border px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-22px_rgba(24,18,8,0.24)] ${
        active
          ? 'border-[#caa55e] bg-[#fbf4df] text-[#1f1c18]'
          : 'border-transparent bg-white text-[#4b453d] hover:border-[#e7ded0]'
      }`}
      title={collapsed ? label : undefined}
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center border border-[#e7ded0] bg-[#fcfaf6] text-[#8a5a44]">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-5">{label}</span>
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877c]">
            {description}
          </span>
        </span>
      ) : null}
    </button>
  )
}

export function MerchantHubShell({
  activeView,
  restaurants,
  currentRestaurant,
  currentRestaurantDetail,
  account,
  roleLabel,
  subtitle,
  onSelectRestaurant,
  onNavigate,
  onLogout,
  children,
}: MerchantHubShellContext & { activeView: MerchantHubRoute }) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const currentRestaurantName = currentRestaurant?.name ?? 'No restaurant selected'
  const currentFreshness = currentRestaurantDetail?.googleMapUrl
    ? merchantHubCopy.states.freshnessNow
    : merchantHubCopy.states.freshnessNext
  const currentFreshnessState = currentRestaurantDetail?.googleMapUrl ? 'now' : 'next'
  const storageKey = useMemo(() => getShellStorageKey(), [])

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved === 'collapsed' || saved === 'expanded') {
      setIsRailCollapsed(saved === 'collapsed')
      return
    }
    setIsRailCollapsed(window.innerWidth < 1440)
  }, [storageKey])

  useEffect(() => {
    window.localStorage.setItem(storageKey, isRailCollapsed ? 'collapsed' : 'expanded')
  }, [isRailCollapsed, storageKey])

  useEffect(() => {
    if (!isDrawerOpen) {
      return undefined
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(202,138,4,0.12),_transparent_32%),linear-gradient(180deg,#fbfaf7_0%,#f4efe6_100%)] text-[#1f1c18]">
      <div
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-200 lg:hidden ${
          isDrawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!isDrawerOpen}
        onClick={() => setIsDrawerOpen(false)}
      />

      <div className="sticky top-0 z-30 border-b border-[#eadfcf] bg-[rgba(251,250,247,0.88)] backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center border border-[#e0d4c1] bg-white text-[#8a5a44] lg:hidden"
              onClick={() => setIsDrawerOpen(true)}
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <div className="inline-flex size-10 items-center justify-center border border-[#e0d4c1] bg-white text-[#ca8a04]">
              <span className="material-symbols-outlined text-[20px]">restaurant</span>
            </div>
            <div>
              <div className="text-[13px] font-black tracking-tight">{merchantHubCopy.brand}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f877c]">
                {merchantHubCopy.productLabel}
              </div>
            </div>
          </div>

          <div className="ml-4 hidden min-w-0 flex-1 items-center gap-2 lg:flex">
            <MerchantHubBadge state={currentFreshnessState}>{currentFreshness}</MerchantHubBadge>
            <div className="truncate text-[13px] text-[#5f584e]">{subtitle}</div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 border border-[#e0d4c1] bg-white px-3 py-2 lg:flex">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Role</span>
              <span className="text-[13px] font-semibold text-[#1f1c18]">{roleLabel}</span>
            </div>
            <div className="hidden items-center gap-2 border border-[#e0d4c1] bg-white px-3 py-2 lg:flex">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                Current restaurant
              </span>
              <span className="max-w-[16rem] truncate text-[13px] font-semibold text-[#1f1c18]">
                {currentRestaurantName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsRailCollapsed((current) => !current)}
              className="hidden size-10 items-center justify-center border border-[#e0d4c1] bg-white text-[#1f1c18] transition hover:border-[#caa55e] hover:text-[#8a5a44] lg:inline-flex"
              aria-label={isRailCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isRailCollapsed ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-10 items-center justify-center border border-[#e0d4c1] bg-white px-4 text-[13px] font-semibold text-[#1f1c18] transition hover:border-[#caa55e] hover:text-[#8a5a44]"
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-4.5rem)] gap-0 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[min(20rem,86vw)] border-r border-[#eadfcf] bg-[#fbfaf7] px-3 py-3 transition-transform duration-200 lg:sticky lg:top-[4.5rem] lg:z-0 lg:flex lg:h-[calc(100vh-4.5rem)] lg:flex-col lg:translate-x-0 ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isRailCollapsed ? 'lg:w-[5.5rem]' : 'lg:w-[17rem]'}`}
        >
          <div className="border border-[#e7ded0] bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex size-10 items-center justify-center border border-[#e0d4c1] bg-[#fcfaf6] text-[#8a5a44]">
                <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
              </div>
              {!isRailCollapsed ? (
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Account</div>
                  <div className="mt-1 text-[16px] font-black tracking-tight text-[#1f1c18]">
                    {account.displayName}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">{account.email}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MerchantHubBadge state="now">{roleLabel}</MerchantHubBadge>
                    <MerchantHubBadge state="next">{account.restaurantCount} restaurants</MerchantHubBadge>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="ml-auto inline-flex size-9 items-center justify-center border border-[#e0d4c1] bg-white text-[#1f1c18] lg:hidden"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close navigation"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          <nav className="mt-3 grid gap-2">
            {MERCHANT_NAV.map((item) => (
              <MerchantRailButton
                key={item.route}
                active={activeView === item.route}
                collapsed={isRailCollapsed}
                label={item.label}
                description={item.description}
                icon={item.icon}
                onClick={() => {
                  setIsDrawerOpen(false)
                  onNavigate(item.route)
                }}
              />
            ))}
          </nav>

          <div className="mt-3 grid gap-3">
            <div className="border border-[#e7ded0] bg-white p-4">
              {!isRailCollapsed ? (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                    Restaurant
                  </div>
                  <div className="mt-2 grid gap-2">
                    <label className="grid gap-1">
                      <span className="text-[12px] font-semibold text-[#1f1c18]">Switch context</span>
                      <select
                        value={currentRestaurant?.id ?? ''}
                        onChange={(event) => onSelectRestaurant(event.target.value)}
                        className="h-11 border border-[#e7ded0] bg-white px-3 text-[13px] text-[#1f1c18] outline-none transition focus:border-[#caa55e]"
                      >
                        {restaurants.length === 0 ? (
                          <option value="">No restaurant available</option>
                        ) : null}
                        {restaurants.map((restaurant) => (
                          <option key={restaurant.id} value={restaurant.id}>
                            {restaurant.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="text-[12px] leading-5 text-[#5f584e]">
                      {currentRestaurantDetail?.address ?? 'No address on file'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-[#8a5a44]">storefront</span>
                </div>
              )}
            </div>

            <div className="border border-[#e7ded0] bg-white p-4">
              {!isRailCollapsed ? (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                    Shortcuts
                  </div>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      className="flex items-center justify-between border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3 text-left text-[13px] font-semibold text-[#1f1c18]"
                      onClick={() => onNavigate('reviews')}
                    >
                      <span>Open reviews</span>
                      <span className="material-symbols-outlined text-[18px] text-[#8a5a44]">arrow_forward</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-between border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3 text-left text-[13px] font-semibold text-[#1f1c18]"
                      onClick={() => onNavigate('actions')}
                    >
                      <span>Fix first</span>
                      <span className="material-symbols-outlined text-[18px] text-[#8a5a44]">arrow_forward</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-[#8a5a44]">bolt</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-3 pb-8 lg:p-6">
          <div className="grid gap-4">{children}</div>
        </div>
      </div>
    </main>
  )
}
