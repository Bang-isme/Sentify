import { useEffect, useMemo, useRef, useState } from 'react'
import { getProductUiCopy } from '../../content/productUiCopy'
import { LANGUAGE_OPTIONS, useLanguage } from '../../contexts/languageContext'
import { useTheme } from '../../contexts/useTheme'
import { getAdminNavigation, getMerchantNavigation, getRouteMeta } from '../../features/app-shell/navigation'
import { isAdminRoute, isProtectedRoute, type AppRoute } from '../../features/app-shell/routes'

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

function isVietnamese(language: string) {
  return language.startsWith('vi')
}

function getHeaderStrings(language: string) {
  if (isVietnamese(language)) {
    return {
      openAccountMenu: 'Mo menu tai khoan',
      languageLabel: 'Ngon ngu',
      themeLabel: 'Chuyen che do sang toi',
      merchantApp: 'Merchant app',
      adminHub: 'Admin hub',
      viewLabel: 'Dang xem',
      roleLabel: 'Role',
      restaurantLabel: 'Restaurant',
    }
  }

  return {
    openAccountMenu: 'Open account menu',
    languageLabel: 'Language',
    themeLabel: 'Toggle theme',
    merchantApp: 'Merchant app',
    adminHub: 'Admin hub',
    viewLabel: 'Viewing',
    roleLabel: 'Role',
    restaurantLabel: 'Restaurant',
  }
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
  const labels = getHeaderStrings(language)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const currentLanguage =
    LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0]
  const isAppRoute = isProtectedRoute(route)
  const isAdminShell = isAdminRoute(route)
  const routeMeta = getRouteMeta(route, language)
  const shellLabel = isAdminShell ? labels.adminHub : labels.merchantApp

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

  const accountActions = useMemo(() => {
    if (!isAuthenticated) {
      return []
    }

    const navItems = isAdminShell
      ? getAdminNavigation(language).flatMap((group) => group.items)
      : getMerchantNavigation(language).flatMap((group) => group.items)

    return [
      {
        id: 'home',
        label: isAdminShell ? (isVietnamese(language) ? 'Command center' : 'Command center') : 'Home',
        onClick: () => onNavigate(homeRoute),
      },
      ...navItems.slice(0, 4).map((item) => ({
        id: item.route,
        label: item.label,
        onClick: () => onNavigate(item.route),
      })),
      ...(isAppRoute
        ? [
            {
              id: 'landing',
              label: productCopy.header.landing,
              onClick: () => onNavigate('/'),
            },
          ]
        : []),
    ]
  }, [homeRoute, isAdminShell, isAppRoute, isAuthenticated, language, onNavigate, productCopy.header.landing])

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#0d1116]/92 backdrop-blur-xl">
      <div className="flex h-[4.25rem] w-full items-center gap-3 px-3 lg:px-5">
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
          <div className="flex size-9 items-center justify-center border border-white/10 bg-white/5 text-amber-300">
            <span className="material-symbols-outlined text-[18px]">token</span>
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="text-[15px] font-semibold text-white">{copy.header.brand}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isProtectedRoute(route) ? shellLabel : 'Sentiment operations'}
            </div>
          </div>
        </button>

        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          {isProtectedRoute(route) ? (
            <>
              <span className="inline-flex border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {labels.viewLabel}
              </span>
              <span className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-white">
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                  {isAdminShell ? 'view_kanban' : 'insights'}
                </span>
                {routeMeta.title}
              </span>
            </>
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
            aria-label={labels.themeLabel}
            className="flex size-8 items-center justify-center text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>

          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsLanguageMenuOpen((current) => !current)
                setIsAccountMenuOpen(false)
              }}
              aria-label={labels.languageLabel}
              aria-haspopup="menu"
              aria-expanded={isLanguageMenuOpen}
              className="flex h-8 items-center gap-1.5 border border-white/10 bg-white/5 px-2.5 text-[12px] font-semibold text-white transition hover:border-white/20"
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
              className={`absolute right-0 top-[calc(100%+0.6rem)] min-w-[10rem] border border-white/10 bg-[#11161c] p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-all duration-150 ${
                isLanguageMenuOpen
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-1 opacity-0'
              }`}
              role="menu"
              aria-label={labels.languageLabel}
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
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? 'bg-white/8 font-semibold text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
                aria-label={labels.openAccountMenu}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                onClick={() => {
                  setIsAccountMenuOpen((current) => !current)
                  setIsLanguageMenuOpen(false)
                }}
                className="group flex h-9 items-center gap-2 border border-white/10 bg-white/5 pl-2 pr-2.5 text-left transition hover:border-white/20"
              >
                <span className="flex size-7 items-center justify-center bg-amber-300 text-[11px] font-black text-[#11161c]">
                  {user?.initials ?? 'S'}
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {user?.displayName ?? productCopy.header.accountFallback}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
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
                className={`absolute right-0 top-[calc(100%+0.75rem)] w-[min(24rem,calc(100vw-1.5rem))] border border-white/10 bg-[#11161c] p-2 shadow-[0_20px_44px_rgba(0,0,0,0.42)] transition-all duration-150 ${
                  isAccountMenuOpen
                    ? 'pointer-events-auto translate-y-0 opacity-100'
                    : 'pointer-events-none -translate-y-1 opacity-0'
                }`}
                role="menu"
                aria-label={labels.openAccountMenu}
              >
                <div className="border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center bg-amber-300 text-sm font-black text-[#11161c]">
                      {user?.initials ?? 'S'}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {user?.displayName ?? productCopy.header.accountFallback}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">{user?.email ?? ''}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                          {user?.roleLabel ?? productCopy.header.protectedAccess}
                        </span>
                        {restaurantLabel ? (
                          <span className="border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                            {restaurantLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-xs leading-5 text-slate-500">{roleDescription}</div>
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
                      className="flex h-10 items-center px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
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
                  className="flex h-10 w-full items-center px-3 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10"
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
                className="flex h-9 items-center justify-center bg-amber-300 px-3.5 text-sm font-semibold text-[#11161c] transition hover:bg-amber-200"
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
