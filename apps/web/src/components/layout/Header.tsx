import { useEffect, useMemo, useRef, useState } from 'react'
import { getProductUiCopy } from '../../content/productUiCopy'
import { LANGUAGE_OPTIONS, useLanguage } from '../../contexts/languageContext'
import { useTheme } from '../../contexts/useTheme'
import { getAdminNavigation, getMerchantNavigation, getRouteMeta } from '../../features/app-shell/navigation'
import { isAdminRoute, isProtectedRoute, type AppRoute } from '../../features/app-shell/routes'
import { getShellChrome } from '../../features/app-shell/shellChrome'

interface HeaderAccountIdentity {
  displayName: string
  email: string
  initials: string
  restaurantCount: number
  selectedRestaurantName?: string
  roleLabel: string
}

interface HeaderProps {
  route: AppRoute
  isAuthenticated: boolean
  user?: HeaderAccountIdentity | null
  roleDescription: string
  homeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  onScrollToSection: (sectionId: string) => void
  onLogout: () => void
}

function MenuDivider() {
  return <div className="my-2 h-px bg-white/8" />
}

export function Header({
  route,
  isAuthenticated,
  user = null,
  roleDescription,
  homeRoute,
  onNavigate,
  onScrollToSection,
  onLogout,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, copy } = useLanguage()
  const productCopy = getProductUiCopy(language)
  const { copy: shellCopy, palette } = useMemo(() => getShellChrome(isAdminRoute(route) ? 'admin' : 'merchant', language), [language, route])
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const currentLanguage =
    LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0]
  const isAppRoute = isProtectedRoute(route)
  const isAdminShell = isAdminRoute(route)
  const routeMeta = getRouteMeta(route, language)
  const shellLabel = isAdminShell ? shellCopy.adminShellLabel : shellCopy.merchantShellLabel

  const restaurantLabel = useMemo(() => {
    if (!user) {
      return null
    }

    if (user.selectedRestaurantName) {
      return user.selectedRestaurantName
    }

    const unit =
      user.restaurantCount === 1
        ? productCopy.header.restaurantSingular
        : productCopy.header.restaurantPlural

    return `${user.restaurantCount} ${unit}`
  }, [productCopy.header.restaurantPlural, productCopy.header.restaurantSingular, user])

  const accountActions = !isAuthenticated
    ? []
    : [
        {
          id: 'home',
          label: shellCopy.homeLabel,
          onClick: () => onNavigate(homeRoute),
        },
        ...(isAdminShell
          ? getAdminNavigation(language).flatMap((group) => group.items)
          : getMerchantNavigation(language).flatMap((group) => group.items)
        )
          .slice(0, 4)
          .map((item) => ({
            id: item.route,
            label: item.label,
            onClick: () => onNavigate(item.route),
          })),
        ...(isAppRoute
          ? [
              {
                id: 'landing',
                label: shellCopy.landingLabel,
                onClick: () => onNavigate('/'),
              },
            ]
          : []),
      ]

  useEffect(() => {
    if (!isLanguageMenuOpen && !isAccountMenuOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (
        isLanguageMenuOpen &&
        languageMenuRef.current &&
        !languageMenuRef.current.contains(target)
      ) {
        setIsLanguageMenuOpen(false)
      }

      if (isAccountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setIsAccountMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false)
        setIsAccountMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountMenuOpen, isLanguageMenuOpen])

  return (
    <header
      className={`app-shell-surface fixed inset-x-0 top-0 z-50 border-b ${palette.railDivider} ${palette.menuSurface}`}
    >
      <div className="flex h-[4.25rem] w-full items-center gap-4 px-4 lg:px-6">
        <button
          type="button"
          className="flex shrink-0 items-center gap-3"
          onClick={() => {
            if (isAuthenticated) {
              onNavigate(homeRoute)
              return
            }

            onScrollToSection('overview')
          }}
        >
          <div className="flex size-9 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="material-symbols-outlined text-[19px]">token</span>
          </div>
          <div className="hidden min-w-0 md:block">
            <div className={`font-display text-[15px] font-semibold tracking-tight ${isAdminRoute(route) ? 'text-slate-900 dark:text-white' : 'text-text-charcoal dark:text-white'}`}>
              {copy.header.brand}
            </div>
            {isProtectedRoute(route) ? (
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <span>{shellLabel}</span>
                <span className="size-1 rounded-full bg-slate-600" />
                <span className="truncate text-[11px] normal-case tracking-normal text-slate-400">
                  {routeMeta.sectionLabel}
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Sentiment operations
              </div>
            )}
          </div>
        </button>

        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          {isProtectedRoute(route) ? (
            <div
              className={`inline-flex max-w-[30rem] items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold text-white ${palette.chip}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {shellCopy.viewLabel}
              </span>
              <span className="size-1 rounded-full bg-slate-600" />
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                  {isAdminShell ? 'view_kanban' : 'insights'}
              </span>
              <span className="truncate">{routeMeta.title}</span>
            </div>
          ) : (
            productCopy.header.marketingLinks.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:text-white"
                onClick={() => onScrollToSection(item.sectionId)}
              >
                {item.label}
              </button>
            ))
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => toggleTheme(event)}
            aria-label={shellCopy.themeLabel}
            data-testid="theme-toggle"
            className={`app-shell-surface flex size-9 items-center justify-center rounded-[12px] border transition ${isAdminRoute(route) ? 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/16 dark:hover:bg-white/[0.05] dark:hover:text-white' : 'border-[#d7e1e7] bg-white text-[#5f6d77] hover:border-[#dde5ea] hover:bg-[#f6fafb] hover:text-[#17212a] dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/16 dark:hover:bg-white/[0.05] dark:hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-lg">
              {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>

          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              data-testid="language-menu-trigger"
              onClick={() => {
                setIsLanguageMenuOpen((current) => !current)
                setIsAccountMenuOpen(false)
              }}
              aria-label={shellCopy.languageLabel}
              aria-haspopup="menu"
              aria-expanded={isLanguageMenuOpen}
              className={`app-shell-surface flex h-9 items-center gap-1.5 rounded-[12px] border px-3 text-[12px] font-semibold transition ${palette.chip} hover:shadow-sm`}
            >
              <span>{currentLanguage.label}</span>
              <span
                className={`material-symbols-outlined text-base transition-transform duration-200 ${
                  isLanguageMenuOpen ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>

            <div
              className={`app-shell-surface absolute right-0 top-[calc(100%+0.5rem)] min-w-[10rem] rounded-[12px] border p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.24)] transition-all duration-150 ${palette.menuSurface} ${
                isLanguageMenuOpen
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-1 opacity-0'
              }`}
              role="menu"
              aria-label={shellCopy.languageLabel}
            >
              {LANGUAGE_OPTIONS.map((option) => {
                const isActive = option.code === language

                return (
                  <button
                    key={option.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => {
                      setLanguage(option.code)
                      setIsLanguageMenuOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-white/8 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isActive ? <span className="material-symbols-outlined text-base">check</span> : null}
                  </button>
                )
              })}
            </div>
          </div>

          {isAuthenticated ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                aria-label={shellCopy.openAccountMenu}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                data-testid="account-menu"
                onClick={() => {
                  setIsAccountMenuOpen((current) => !current)
                  setIsLanguageMenuOpen(false)
                }}
                className={`app-shell-surface group flex h-10 items-center gap-2 rounded-[14px] border pl-2 pr-3 text-left transition hover:shadow-sm ${palette.chip}`}
              >
                <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary text-[11px] font-black text-[#08131b]">
                  {user?.initials ?? 'S'}
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className={`block truncate text-[13px] font-semibold ${isAdminRoute(route) ? 'text-slate-900 dark:text-white' : 'text-text-charcoal dark:text-white'}`}>
                    {user?.displayName ?? productCopy.header.accountFallback}
                  </span>
                  <span className={`block truncate text-[11px] ${isAdminRoute(route) ? 'text-slate-500 dark:text-zinc-400' : 'text-[#8f877c] dark:text-[#8f877c]'}`}>
                    {restaurantLabel ?? roleDescription}
                  </span>
                </span>
                <span
                  className={`material-symbols-outlined text-base text-slate-500 transition-transform duration-200 ${
                    isAccountMenuOpen ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>

              <div
                className={`app-shell-surface absolute right-0 top-[calc(100%+0.65rem)] w-[min(24rem,calc(100vw-1.5rem))] rounded-[14px] border p-2 shadow-[0_20px_44px_rgba(0,0,0,0.24)] transition-all duration-150 ${palette.menuSurface} ${
                  isAccountMenuOpen
                    ? 'pointer-events-auto translate-y-0 opacity-100'
                    : 'pointer-events-none -translate-y-1 opacity-0'
                }`}
                role="menu"
                aria-label={shellCopy.openAccountMenu}
              >
                <div className={`app-shell-surface rounded-[12px] border p-4 ${palette.heroPanel}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary text-sm font-black text-[#08131b]">
                      {user?.initials ?? 'S'}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {user?.displayName ?? productCopy.header.accountFallback}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{user?.email ?? ''}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                          {user?.roleLabel ?? productCopy.header.protectedAccess}
                        </span>
                        {restaurantLabel ? (
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${palette.chipMuted}`}>
                            {restaurantLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <MenuDivider />

                <div className="grid gap-1">
                  {accountActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      className="flex h-10 items-center rounded-[10px] px-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                      onClick={() => {
                        setIsAccountMenuOpen(false)
                        action.onClick()
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                <MenuDivider />

                <button
                  type="button"
                  role="menuitem"
                  data-testid="logout-action"
                  className="flex h-10 w-full items-center rounded-[10px] px-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  onClick={() => {
                    setIsAccountMenuOpen(false)
                    onLogout()
                  }}
                >
                  {productCopy.header.logout}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="hidden h-9 items-center justify-center px-2 text-sm font-medium text-slate-300 transition hover:text-white md:inline-flex"
                onClick={() => onNavigate('/login')}
              >
                {productCopy.header.login}
              </button>
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-[10px] bg-primary px-3.5 text-sm font-semibold text-[#08131b] transition hover:bg-primary-dark"
                onClick={() => onNavigate('/signup')}
              >
                {productCopy.header.signup}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
