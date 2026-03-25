import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { NavGroup, RouteStage } from './navigation'

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

function isVietnamese(language: string) {
  return language.startsWith('vi')
}

function getStorageKey(mode: 'merchant' | 'admin') {
  return `sentify-shell-nav-${mode}`
}

function getStrings(language: string) {
  if (isVietnamese(language)) {
    return {
      navigation: 'Dieu huong',
      collapse: 'Thu gon sidebar',
      expand: 'Mo rong sidebar',
      openNavigation: 'Mo menu',
      closeNavigation: 'Dong menu',
      now: 'Now',
      next: 'Next',
    }
  }

  return {
    navigation: 'Navigation',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
    now: 'Now',
    next: 'Next',
  }
}

function getBadgeClasses(tone: ShellBadge['tone']) {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200 dark:text-emerald-200'
    case 'warning':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-200 dark:text-amber-200'
    case 'danger':
      return 'border-red-500/25 bg-red-500/10 text-red-200 dark:text-red-200'
    default:
      return 'border-white/10 bg-white/5 text-slate-200 dark:text-slate-200'
  }
}

function getStageClasses(stage: RouteStage) {
  return stage.tone === 'next'
    ? 'border-sky-400/25 bg-sky-400/10 text-sky-200'
    : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
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
  const strings = useMemo(() => getStrings(language), [language])
  const storageKey = useMemo(() => getStorageKey(mode), [mode])
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const palette =
    mode === 'admin'
      ? {
          shell: 'bg-[#0f1114] text-slate-100',
          sidebar: 'border-r border-white/8 bg-[#12161b]',
          sidebarPanel: 'border border-white/6 bg-[#171c22]',
          activeItem: 'border-sky-400/20 bg-sky-400/10 text-white',
          idleItem: 'border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.03] hover:text-white',
          page: 'bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,#0f1114_0%,#0b0d10_100%)]',
          pagePanel: 'border border-white/7 bg-[#12161b]',
          mutedPanel: 'border border-white/6 bg-[#161b21]',
          accent: 'text-sky-300',
        }
      : {
          shell: 'bg-[#0d1116] text-slate-100',
          sidebar: 'border-r border-white/8 bg-[#10161b]',
          sidebarPanel: 'border border-white/6 bg-[#151d23]',
          activeItem: 'border-emerald-400/20 bg-emerald-400/10 text-white',
          idleItem: 'border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.03] hover:text-white',
          page: 'bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.08),transparent_28%),linear-gradient(180deg,#0d1116_0%,#0b0f13_100%)]',
          pagePanel: 'border border-white/7 bg-[#10161b]',
          mutedPanel: 'border border-white/6 bg-[#151c22]',
          accent: 'text-emerald-300',
        }

  return (
    <main className={`min-h-screen ${palette.shell}`}>
      <div className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setMobileOpen(false)} />

      <div className="flex min-h-screen pt-[4.4rem]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col ${palette.sidebar} px-3 pb-4 pt-[4.9rem] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0 lg:pt-[5.2rem] ${collapsed ? 'lg:w-[88px]' : 'lg:w-[280px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className={`mb-3 flex items-start gap-3 px-1 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="flex size-9 shrink-0 items-center justify-center border border-white/10 bg-white/5">
              <span className={`material-symbols-outlined text-[18px] ${palette.accent}`}>
                {mode === 'admin' ? 'admin_panel_settings' : 'storefront'}
              </span>
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {productLabel}
                </div>
                <div className="mt-1 text-[15px] font-semibold text-white">{sectionLabel}</div>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:text-white lg:hidden"
                aria-label={strings.closeNavigation}
                onClick={() => setMobileOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <button
                type="button"
                className="hidden size-8 items-center justify-center border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:text-white lg:inline-flex"
                aria-label={collapsed ? strings.expand : strings.collapse}
                onClick={() => setCollapsed((current) => !current)}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                </span>
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto px-1 ${collapsed ? 'space-y-3' : 'space-y-4'}`}>
            {navGroups.map((group) => (
              <section key={group.label} className={`px-1 py-1 ${collapsed ? '' : `${palette.sidebarPanel} p-2`}`}>
                {!collapsed ? (
                  <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {group.label}
                  </div>
                ) : null}
                <div className="grid gap-1.5">
                  {group.items.map((item) => {
                    const active = item.route === route

                    return (
                      <button
                        key={item.route}
                        type="button"
                        title={collapsed ? item.label : undefined}
                        aria-label={item.label}
                        className={`group flex items-center gap-3 border px-2.5 py-2 text-left transition ${active ? palette.activeItem : palette.idleItem}`}
                        onClick={() => {
                          setMobileOpen(false)
                          onNavigate(item.route)
                        }}
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center border border-white/10 bg-white/5 text-slate-200">
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </span>
                        {!collapsed ? (
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold">{item.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                              {item.description}
                            </span>
                          </span>
                        ) : null}
                        {!collapsed ? (
                          <span className={`inline-flex shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getStageClasses(item.stage)}`}>
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

          {sidebarFooter ? (
            <div className={`mt-3 px-1 ${collapsed ? '' : `${palette.sidebarPanel} p-2`}`}>{sidebarFooter}</div>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="w-full px-3 pb-6 lg:px-5">
            <button
              type="button"
              className={`mb-3 inline-flex size-9 items-center justify-center border border-white/10 bg-white/5 text-slate-200 lg:hidden ${palette.pagePanel}`}
              aria-label={strings.openNavigation}
              onClick={() => setMobileOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">menu</span>
            </button>

            <section className={`${palette.pagePanel} ${palette.page} mb-4 px-4 py-4 lg:px-6 lg:py-5`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStageClasses(stage)}`}>
                      {stage.label}
                    </span>
                    <span className="inline-flex border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {sectionLabel}
                    </span>
                    {badges.map((badge) => (
                      <span
                        key={`${badge.label}-${badge.tone ?? 'neutral'}`}
                        className={`inline-flex border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getBadgeClasses(badge.tone)}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <h1 className="max-w-5xl text-[28px] font-semibold tracking-[-0.03em] text-white lg:text-[34px]">
                    {title}
                  </h1>
                  <p className="mt-3 max-w-4xl text-[14px] leading-6 text-slate-400">{description}</p>
                </div>
                {contextSlot ? <div className="xl:max-w-[420px] xl:min-w-[320px]">{contextSlot}</div> : null}
              </div>
            </section>

            <section className="grid gap-4">{children}</section>
          </div>
        </div>
      </div>
    </main>
  )
}
