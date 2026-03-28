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

 

export function ShellLayout<RouteId extends string>({
  mode,
  route,
  language,
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const { copy, palette } = chrome
  const isAdmin = mode === 'admin'
  
  // Clean Workspace Typography
  const bodyTitleClass = isAdmin ? 'text-slate-900 dark:text-white' : 'text-slate-900'
  const bodyCopyClass = isAdmin ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-500'

 

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
      className={`relative min-h-screen font-sans antialiased selection:bg-indigo-500/30 ${palette.shell}`}
    >
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden transition-opacity ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <div className="relative flex min-h-screen pt-[7.75rem] lg:pt-[4.25rem]">
        {/* Mobile Header */}
        <header className={`fixed inset-x-0 top-[4.25rem] z-30 flex h-14 items-center justify-between border-b px-4 lg:hidden ${palette.rail} ${palette.railDivider}`}>
          <div className={`font-semibold text-sm tracking-tight ${isAdmin ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-900'}`}>
            {mode === 'admin' ? 'ADMIN' : 'MERCHANT'} <span className="mx-1 text-slate-400">•</span> <span className="text-slate-500">{sectionLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`flex size-8 items-center justify-center rounded-lg ${palette.railItemIdle}`}
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        </header>

        {/* Sidebar */}
        <aside
          data-testid={isAdmin ? 'admin-nav' : 'merchant-nav'}
          className={`group/sidebar app-shell-rail fixed bottom-0 left-0 top-0 z-40 flex w-[min(300px,86vw)] lg:w-[72px] lg:hover:w-[280px] flex-col border-r overflow-hidden ${palette.rail} ${palette.railDivider} transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:sticky lg:top-[4.25rem] lg:z-20 lg:h-[calc(100vh-4.25rem)] lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Inner Sliding Window */}
          <div className="flex h-full w-[min(300px,86vw)] lg:w-[280px] flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Sidebar Navigation */}
            <div className="flex-1 px-3 py-4 space-y-6">
            {/* Mobile Close Toggle */}
            <div className="mb-2 flex items-center justify-end lg:hidden">
              <button
                type="button"
                className={`inline-flex size-8 items-center justify-center rounded-lg transition ${palette.railItemIdle}`}
                aria-label={copy.closeNavigation}
                onClick={() => setMobileOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {navGroups.map((group) => (
              <section key={group.label}>
                <div className={`px-4 mb-2 text-[11px] font-bold uppercase tracking-[0.15em] opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300 ${palette.railSectionLabel}`}>
                  {group.label}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  {group.items.map((item) => {
                    const active = item.route === route

                    return (
                      <button
                        key={item.route}
                        type="button"
                        aria-label={item.label}
                        data-testid={`nav-${String(item.route).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}`}
                        data-active={active ? 'true' : 'false'}
                        className={`group flex items-center gap-3 w-full min-w-0 px-4 py-2 transition rounded-xl justify-start ${
                          active ? palette.railItemActive : palette.railItemIdle
                        }`}
                        onClick={() => {
                          setMobileOpen(false)
                          onNavigate(item.route)
                        }}
                      >
                        <span className="inline-flex size-6 shrink-0 items-center justify-center">
                          <span className={`material-symbols-outlined text-[20px] ${active ? palette.accent : palette.railIcon}`}>
                            {item.icon}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 flex flex-col items-start text-start opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300">
                          <span className="text-[14px] leading-snug truncate w-full">
                            {item.label}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className={`mt-auto flex shrink-0 flex-col gap-3 border-t ${palette.railDivider} min-w-0 p-4`}>
            {sidebarFooter}
          </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 xl:py-10">
            {/* Page Header Area */}
            <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${getShellStageClass(stage.tone)}`}>
                    {stage.label}
                  </span>
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${palette.chipMuted}`}>
                    {sectionLabel}
                  </span>
                  {badges.map((badge) => (
                    <span
                      key={`${badge.label}-${badge.tone ?? 'neutral'}`}
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${getShellBadgeClass(badge.tone)}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <h1 className={`text-3xl font-bold tracking-tight md:text-4xl ${bodyTitleClass}`}>
                  {title}
                </h1>
                <p className={`mt-2 text-base ${bodyCopyClass}`}>
                  {description}
                </p>
              </div>

              {contextSlot ? (
                <div className="shrink-0 w-full md:w-[350px] lg:w-[420px]">
                  {contextSlot}
                </div>
              ) : null}
            </div>

            {/* Page Content */}
            <div className="grid gap-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
