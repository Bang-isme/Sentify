import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { NavGroup, RouteStage } from './navigation'
import {
  getShellBadgeClass,
  getShellChrome,
  getShellStageClass,
} from './shellChrome'

interface ShellBadge {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

interface ShellLayoutProps<RouteId extends string> {
  mode: 'merchant' | 'admin'
  route: RouteId
  language: string
  productLabel: string
  sectionLabel: string
  title: string
  description: string
  stage: RouteStage
  navGroups: NavGroup<RouteId>[]
  badges?: ShellBadge[]
  contextSlot?: ReactNode
  sidebarFooter?: ReactNode
  onNavigate: (route: RouteId) => void
  children: ReactNode
}

function getStorageKey(mode: 'merchant' | 'admin') {
  return `sentify-shell-nav-${mode}`
}

export function ShellLayout<RouteId extends string>({
  mode,
  route,
  language,
  productLabel,
  sectionLabel,
  title,
  description,
  stage,
  navGroups,
  badges = [],
  contextSlot,
  sidebarFooter,
  onNavigate,
  children,
}: ShellLayoutProps<RouteId>) {
  const chrome = useMemo(() => getShellChrome(mode, language), [language, mode])
  const storageKey = useMemo(() => getStorageKey(mode), [mode])
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { copy, palette } = chrome
  const isAdmin = mode === 'admin'
  const railTitleClass = isAdmin ? 'text-white' : 'text-[#1b2329]'
  const railMetaClass = isAdmin ? 'text-slate-500' : 'text-[#766a58]'
  const bodyTitleClass = isAdmin ? 'text-white' : 'text-[#1c2329]'
  const bodyCopyClass = isAdmin ? 'text-slate-400' : 'text-[#5f625b]'

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved === 'collapsed' || saved === 'expanded') {
      setCollapsed(saved === 'collapsed')
      return
    }

    setCollapsed(mode === 'admin' ? window.innerWidth < 1360 : window.innerWidth < 1240)
  }, [mode, storageKey])

  useEffect(() => {
    window.localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded')
  }, [collapsed, storageKey])

  useEffect(() => {
    if (!mobileOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  return (
    <main
      data-testid={isAdmin ? 'admin-shell' : 'merchant-shell'}
      className={`app-shell-shell relative min-h-screen overflow-x-hidden ${palette.shell}`}
    >
      <div className={`pointer-events-none absolute inset-0 ${palette.backdropOne}`} />
      <div className={`pointer-events-none absolute inset-0 ${palette.backdropTwo} opacity-70`} />
      <div
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <div className="relative flex min-h-screen pt-[3.75rem]">
        <aside
          data-testid={isAdmin ? 'admin-nav' : 'merchant-nav'}
          className={`app-shell-rail fixed bottom-0 left-0 top-[3.75rem] z-50 flex w-[min(300px,84vw)] flex-col border-r ${palette.rail} transition-transform duration-200 lg:sticky lg:z-20 lg:h-[calc(100vh-3.75rem)] lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]'} ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div
            className={`flex items-start gap-3 border-b ${palette.railDivider} px-4 py-3 ${
              collapsed ? 'lg:justify-center lg:px-3' : ''
            }`}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04]">
              <span className={`material-symbols-outlined text-[18px] ${palette.accent}`}>
                {mode === 'admin' ? 'admin_panel_settings' : 'storefront'}
              </span>
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${railMetaClass}`}>
                  {productLabel}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <div className={`truncate text-[14px] font-semibold ${railTitleClass}`}>{sectionLabel}</div>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${palette.chipMuted}`}>
                    {mode === 'admin' ? 'ADMIN' : 'USER'}
                  </span>
                </div>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/20 hover:text-white lg:hidden"
                aria-label={copy.closeNavigation}
                onClick={() => setMobileOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <button
                type="button"
                className="hidden size-8 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/20 hover:text-white lg:inline-flex"
                aria-label={collapsed ? copy.expand : copy.collapse}
                onClick={() => setCollapsed((current) => !current)}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2.5">
            {navGroups.map((group) => (
              <section key={group.label} className="py-1.5 first:pt-0">
                {!collapsed ? (
                  <div
                    className={`px-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${palette.railSectionLabel}`}
                  >
                    {group.label}
                  </div>
                ) : null}
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => {
                    const active = item.route === route

                    return (
                      <button
                        key={item.route}
                        type="button"
                        title={collapsed ? item.label : undefined}
                        aria-label={item.label}
                        data-testid={`nav-${String(item.route).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}`}
                        className={`app-shell-rail-item group flex items-center gap-3 border px-2.5 py-2 text-left transition ${
                          active ? palette.railItemActive : palette.railItemIdle
                        } ${collapsed ? 'justify-center rounded-[12px] px-2.5' : 'rounded-[12px]'}`}
                        onClick={() => {
                          setMobileOpen(false)
                          onNavigate(item.route)
                        }}
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-slate-200">
                          <span className={`material-symbols-outlined text-[18px] ${palette.railIcon}`}>
                            {item.icon}
                          </span>
                        </span>
                        {!collapsed ? (
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">{item.label}</span>
                            <span className={`mt-0.5 block truncate text-[11px] leading-5 ${railMetaClass}`}>
                              {item.description}
                            </span>
                          </span>
                        ) : null}
                        {!collapsed ? (
                          <span
                            className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getShellStageClass(item.stage.tone)}`}
                          >
                            {item.stage.label}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {sidebarFooter ? <div className={`border-t ${palette.railDivider} px-3 py-3`}>{sidebarFooter}</div> : null}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1920px] px-3 pb-6 lg:px-5">
            <button
              type="button"
              className={`mb-3 inline-flex size-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-slate-200 lg:hidden ${palette.heroPanel}`}
              aria-label={copy.openNavigation}
              onClick={() => setMobileOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">menu</span>
            </button>

            <section className={`app-shell-panel app-shell-surface ${palette.hero} mb-4 overflow-hidden rounded-[14px] px-3.5 py-3 lg:px-4 lg:py-3`}>
              <div className="relative flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_clamp(260px,24vw,340px)] xl:items-start xl:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getShellStageClass(stage.tone)}`}
                    >
                      {stage.label}
                    </span>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.chipMuted}`}>
                      {sectionLabel}
                    </span>
                    {badges.map((badge) => (
                      <span
                        key={`${badge.label}-${badge.tone ?? 'neutral'}`}
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getShellBadgeClass(badge.tone)}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <h1 className={`mt-3 max-w-5xl text-[22px] font-semibold tracking-[-0.03em] lg:text-[26px] ${bodyTitleClass}`}>
                    {title}
                  </h1>
                  <p className={`mt-2.5 max-w-4xl text-[13px] leading-6 ${bodyCopyClass}`}>{description}</p>
                </div>
                {contextSlot ? (
                  <div className={`rounded-[12px] border px-3 py-3 ${palette.heroPanel}`}>{contextSlot}</div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-3 lg:gap-4">{children}</section>
          </div>
        </div>
      </div>
    </main>
  )
}
