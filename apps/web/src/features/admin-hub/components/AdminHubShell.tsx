import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  adminHubDomains,
  adminHubHomeStats,
  getAdminHubDomainFromView,
  type AdminHubViewKey,
} from '../adminHub.data'

interface AdminHubShellProps {
  activeView: AdminHubViewKey
  adminLabel: string
  restaurantLabel?: string
  restaurantCountLabel?: string
  onNavigate?: (view: AdminHubViewKey) => void
  children: ReactNode
}

function getStoredRailState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem('sentify-admin-hub-rail') === 'collapsed'
}

function statusTone(status: 'Now' | 'Next') {
  return status === 'Now'
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
}

export function AdminHubShell({
  activeView,
  adminLabel,
  restaurantLabel = '0 restaurants',
  restaurantCountLabel = 'Scope',
  onNavigate,
  children,
}: AdminHubShellProps) {
  const [collapsed, setCollapsed] = useState(() => getStoredRailState())

  useEffect(() => {
    window.localStorage.setItem('sentify-admin-hub-rail', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  const activeDomain = useMemo(() => getAdminHubDomainFromView(activeView), [activeView])
  const currentScreen = useMemo(() => {
    if (activeView === 'home') {
      return null
    }

    return adminHubDomains[activeDomain].screens.find((screen) => screen.key === activeView) ?? null
  }, [activeDomain, activeView])

  const railWidth = collapsed ? 'lg:w-[88px]' : 'lg:w-[298px]'

  return (
    <div className="min-h-screen bg-[#11110d] text-[#f4edd8]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(61,76,37,0.18),transparent_28%),linear-gradient(180deg,#11110d_0%,#15140f_58%,#10100c_100%)]" />

      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#11110d]/90 backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-3 py-2 sm:px-4 lg:px-5">
            <button
              type="button"
              onClick={() => onNavigate?.('home')}
              className="flex items-center gap-3 rounded-none border border-white/5 bg-white/3 px-3 py-2 transition hover:border-primary/25 hover:bg-white/5"
            >
              <span className="flex size-9 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[18px]">token</span>
              </span>
              <span className="hidden text-sm font-semibold tracking-[0.18em] uppercase text-[#f4edd8] sm:block">
                Sentify
              </span>
            </button>

            <div className="hidden items-center gap-2 lg:flex">
              <span className="border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                Admin control plane
              </span>
              <span className="border border-white/8 bg-white/4 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#beb79d]">
                {adminLabel}
              </span>
              <span className="border border-white/8 bg-white/4 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#beb79d]">
                {restaurantCountLabel}: {restaurantLabel}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 border border-white/8 bg-white/4 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4edd8] transition hover:border-primary/25 hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                Dark
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 border border-white/8 bg-white/4 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4edd8] transition hover:border-primary/25 hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">translate</span>
                EN
              </button>
              <div className="flex h-9 items-center gap-2 border border-white/8 bg-white/4 px-3">
                <span className="flex size-6 items-center justify-center bg-primary text-[10px] font-black text-[#11110d]">
                  AD
                </span>
                <div className="hidden leading-tight md:block">
                  <div className="text-[12px] font-semibold text-[#f4edd8]">{adminLabel}</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#beb79d]">
                    {activeView === 'home' ? 'Command center' : currentScreen?.label ?? 'Current view'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[auto_minmax(0,1fr)]">
          <aside className={`hidden min-h-0 border-r border-white/5 bg-[#13120e]/80 lg:block ${railWidth}`}>
            <div className="sticky top-[68px] flex h-[calc(100vh-68px)] flex-col gap-4 overflow-y-auto p-3">
              <div className="border border-white/6 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  </div>
                  {!collapsed ? (
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9e977f]">
                        Command center
                      </div>
                      <div className="mt-1 text-[18px] font-semibold tracking-tight text-[#f4edd8]">
                        Admin hub
                      </div>
                      <p className="mt-2 text-[12px] leading-6 text-[#a9a286]">
                        Three domains, two role-safe surfaces, one full-width control plane.
                      </p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    aria-label={collapsed ? 'Expand rail' : 'Collapse rail'}
                    onClick={() => setCollapsed((current) => !current)}
                    className="inline-flex size-9 items-center justify-center border border-white/8 bg-white/4 text-[#f4edd8] transition hover:border-primary/25 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid gap-2 border border-white/6 bg-white/[0.03] p-3">
                {!collapsed ? (
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9e977f]">
                    Navigate
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-label="Open home command center"
                  onClick={() => onNavigate?.('home')}
                  className={`flex items-center gap-3 border px-3 py-3 text-left transition ${
                    activeView === 'home'
                      ? 'border-primary/25 bg-primary/10 text-[#fff8e0]'
                      : 'border-transparent bg-transparent text-[#d1cab0] hover:border-white/8 hover:bg-white/4'
                  }`}
                >
                  <span className="flex size-9 items-center justify-center border border-white/8 bg-white/4 text-primary">
                    <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
                  </span>
                  {!collapsed ? (
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">Home</span>
                      <span className="block text-[10px] uppercase tracking-[0.18em] text-[#9e977f]">
                        Command center
                      </span>
                    </span>
                  ) : null}
                </button>

                {Object.values(adminHubDomains).map((domain) => (
                  <div key={domain.key} className="grid gap-1">
                    {!collapsed ? (
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9e977f]">
                        {domain.label}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Open ${domain.label}`}
                      onClick={() => onNavigate?.(domain.screens[0].key)}
                      className={`flex items-center gap-3 border px-3 py-3 text-left transition ${
                        activeDomain === domain.key
                          ? 'border-primary/25 bg-primary/10 text-[#fff8e0]'
                          : 'border-transparent bg-transparent text-[#d1cab0] hover:border-white/8 hover:bg-white/4'
                      }`}
                    >
                      <span className="flex size-9 items-center justify-center border border-white/8 bg-white/4 text-primary">
                        <span className="material-symbols-outlined text-[18px]">{domain.icon}</span>
                      </span>
                      {!collapsed ? (
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold">{domain.label}</span>
                          <span className="block text-[10px] uppercase tracking-[0.18em] text-[#9e977f]">
                            {domain.eyebrow}
                          </span>
                        </span>
                      ) : null}
                    </button>

                    {!collapsed ? (
                      <div className="ml-4 grid gap-1 border-l border-white/6 pl-3">
                        {domain.screens.map((screen) => (
                          <button
                            key={screen.key}
                            type="button"
                            aria-label={`Open ${screen.label}`}
                            onClick={() => onNavigate?.(screen.key)}
                            className={`flex items-center justify-between gap-2 border px-3 py-2 text-left transition ${
                              activeView === screen.key
                                ? 'border-primary/20 bg-primary/8 text-[#fff8e0]'
                                : 'border-transparent bg-transparent text-[#c9c2a7] hover:border-white/8 hover:bg-white/4'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium">{screen.label}</span>
                              <span className="block text-[10px] uppercase tracking-[0.18em] text-[#918b74]">
                                {screen.status}
                              </span>
                            </span>
                            <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${statusTone(screen.status)}`}>
                              {screen.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {!collapsed ? (
                <div className="grid gap-2 border border-white/6 bg-white/[0.03] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9e977f]">
                    Now / Next
                  </div>
                  {adminHubHomeStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between border border-white/6 bg-white/[0.03] px-3 py-2 text-sm text-[#f4edd8]"
                    >
                      <span>{stat.label}</span>
                      <span className="text-primary">{stat.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>

          <main className="min-w-0 px-3 py-4 sm:px-4 lg:px-5 lg:py-5">
            <div className="mb-4 flex flex-wrap items-center gap-2 border border-white/6 bg-white/[0.03] px-4 py-3">
              <span className="border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                {activeView === 'home' ? 'Home' : adminHubDomains[activeDomain].label}
              </span>
              {currentScreen ? (
                <span className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${statusTone(currentScreen.status)}`}>
                  {currentScreen.status}
                </span>
              ) : null}
              <span className="text-[12px] text-[#b5ae93]">
                {currentScreen?.summary ?? 'Command-center overview for all three domains.'}
              </span>
            </div>

            <div className="space-y-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
