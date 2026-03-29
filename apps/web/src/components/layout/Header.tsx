import { useEffect, useMemo, useRef, useState } from 'react'
import { getProductUiCopy } from '../../content/productUiCopy'
import { LANGUAGE_OPTIONS, useLanguage } from '../../contexts/languageContext'
import { useTheme } from '../../contexts/useTheme'

type HeaderRoute =
  | '/'
  | '/login'
  | '/signup'
  | '/forgot-password'
  | '/app'
  | '/app/reviews'
  | '/app/settings'

interface HeaderAccountIdentity {
  displayName: string
  email: string
  initials: string
  restaurantCount: number
  selectedRestaurantName?: string
}

interface HeaderProps {
  route: HeaderRoute
  isAuthenticated: boolean
  user?: HeaderAccountIdentity | null
  onNavigate: (route: HeaderRoute) => void
  onScrollToSection: (sectionId: string) => void
  onLogout: () => void
}

function MenuDivider() {
  return <div className="my-2 h-px bg-border-light/80 dark:bg-border-dark/80"></div>
}

export function Header({
  route,
  isAuthenticated,
  user = null,
  onNavigate,
  onScrollToSection,
  onLogout,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, copy } = useLanguage()
  const productCopy = getProductUiCopy(language)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isLandingScrolled, setIsLandingScrolled] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const currentLanguage =
    LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0]
  const isAppRoute = route.startsWith('/app')
  const isLandingRoute = route === '/'
  const isOnboardingAppRoute = isAppRoute && isAuthenticated && (user?.restaurantCount ?? 0) === 0
  const isAuthRoute =
    route === '/login' || route === '/signup' || route === '/forgot-password'
  const useLandingChrome = !isAppRoute || isOnboardingAppRoute
  const marketingSurfaceVisible = isLandingRoute ? isLandingScrolled : true
  const isLandingCompact = isLandingRoute && isLandingScrolled
  const marketingShellCompact = isLandingRoute ? isLandingCompact : false
  const currentViewLabel =
    route === '/app'
      ? productCopy.header.dashboard
      : route === '/app/reviews'
        ? productCopy.header.reviews
        : route === '/app/settings'
          ? productCopy.header.settings
          : null
  const onboardingAppLinks = [
    { id: 'dashboard', label: productCopy.header.dashboard, route: '/app' as const },
    { id: 'settings', label: productCopy.header.settings, route: '/app/settings' as const },
    { id: 'reviews', label: productCopy.header.reviews, route: '/app/reviews' as const },
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

  useEffect(() => {
    if (!isLandingRoute) {
      return undefined
    }

    function handleScroll() {
      setIsLandingScrolled(window.scrollY > 20)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isLandingRoute])

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

  const marketingLinks = useMemo(() => {
    const extraLinksByLanguage = {
      en: [
        { label: 'Dashboard', sectionId: 'dashboard' },
        { label: 'Signals', sectionId: 'signals' },
      ],
      vi: [
        { label: 'Dashboard', sectionId: 'dashboard' },
        { label: 'Tín hiệu', sectionId: 'signals' },
      ],
      ja: [
        { label: 'ダッシュボード', sectionId: 'dashboard' },
        { label: 'シグナル', sectionId: 'signals' },
      ],
    } as const

    const baseLinks = productCopy.header.marketingLinks

    if (baseLinks.length >= 4) {
      return baseLinks
    }

    return [
      baseLinks[0] ?? { label: 'How it works', sectionId: 'workflow' },
      ...extraLinksByLanguage[language],
      baseLinks[1] ?? { label: 'Security', sectionId: 'trust' },
    ]
  }, [language, productCopy.header.marketingLinks])

  const accountActions = isAuthenticated
    ? [
        !isAppRoute
          ? {
              id: 'dashboard',
              label: productCopy.landing.ctaPrimaryAuthenticated,
              onClick: () => onNavigate('/app'),
            }
          : null,
        isAppRoute
          ? {
              id: 'landing',
              label: productCopy.header.landing,
              onClick: () => onNavigate('/'),
            }
          : null,
        !isAppRoute && route !== '/'
          ? {
              id: 'landing',
              label: productCopy.header.landing,
              onClick: () => onNavigate('/'),
            }
          : null,
      ].flatMap((action) => (action ? [action] : []))
    : []

  const authHeaderLeftTextClass = isAuthRoute
    ? 'text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.45)]'
    : ''
  const authHeaderRightTextClass = isAuthRoute ? 'text-[#1a1a1a]' : ''

  const shellClassName = useLandingChrome
    ? `pointer-events-auto relative grid w-full max-w-[1820px] ${
        isAuthRoute
          ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
          : 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
      } items-center px-2 text-[#1a1a1a] transition-all duration-300 dark:text-[#fff7ef] sm:px-3 md:px-4 lg:px-5 xl:px-6 ${
        marketingShellCompact
          ? 'min-h-[3.55rem] gap-2.5 md:min-h-[3.65rem] lg:min-h-[3.75rem]'
          : 'min-h-[4.15rem] gap-3'
      } ${
        marketingSurfaceVisible ? 'animate-landing-header-shell' : ''
      }`
    : `pointer-events-auto mx-4 flex w-full max-w-[1260px] items-center gap-3 rounded-full border border-border-light/70 bg-surface-white/90 px-4 shadow-[0_10px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300 hover:border-primary/30 dark:border-border-dark/70 dark:bg-surface-dark/92 dark:shadow-[0_10px_34px_rgba(0,0,0,0.5)] md:px-6 ${
        'min-h-16 md:min-h-[4.5rem]'
      }`

  const headerClassName = useLandingChrome
    ? `pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        isAuthRoute
          ? 'border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
          : marketingSurfaceVisible
          ? 'border-b border-[#f3e4d3] bg-white/98 shadow-[0_2px_15px_rgba(0,0,0,0.03)] backdrop-blur-sm dark:border-[#3f2c1f] dark:bg-[#17100c]/96 dark:shadow-[0_12px_30px_-22px_rgba(0,0,0,0.65)]'
          : 'border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
      }`
    : 'pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center transition-transform duration-300 ease-out md:top-5'

  return (
    <header className={headerClassName}>
      <div className={shellClassName}>
        <button
          type="button"
          className={`group min-w-0 justify-self-start flex shrink-0 items-center transition-all duration-300 ${
            isLandingCompact ? 'gap-2.5' : 'gap-3'
          } ${isAuthRoute ? 'col-start-1 row-start-1' : ''}`}
          onClick={() => {
            if (isAuthenticated) {
              onNavigate('/app')
              return
            }

            onScrollToSection('overview')
          }}
        >
          <div
            className={`flex items-center justify-center rounded-full transition-all duration-300 ${
              useLandingChrome
                ? `${marketingShellCompact ? 'size-7 rounded-[0.85rem]' : 'size-7.5 rounded-[0.9rem]'} bg-[#ff8c00] text-white shadow-[0_10px_24px_-14px_rgba(255,140,0,0.65)] group-hover:scale-105 dark:bg-gradient-to-br dark:from-[#f29a40] dark:to-[#d96f1d] dark:text-[#1b120c]`
                : 'size-9 border border-primary/25 bg-primary/8 text-primary group-hover:rotate-180'
            }`}
          >
            {useLandingChrome ? (
              <span
                className={`material-symbols-outlined font-bold transition-all duration-300 ${
                  marketingShellCompact ? 'text-[16px]' : 'text-[17px]'
                }`}
              >
                bolt
              </span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">token</span>
            )}
          </div>
          <span
            className={`hidden tracking-tight sm:block ${
              useLandingChrome
                ? `${isOnboardingAppRoute ? 'text-[1.22rem]' : marketingShellCompact ? 'text-[0.88rem] md:text-[0.9rem]' : 'text-[0.98rem]'} ${
                    isOnboardingAppRoute ? 'font-bold' : 'font-bold'
                  } ${
                    isAuthRoute
                      ? authHeaderLeftTextClass
                      : 'text-[#1a1a1a] dark:text-[#fff7ef]'
                  } transition-all duration-300`
                : 'text-lg font-bold text-text-charcoal dark:text-white'
            }`}
            style={useLandingChrome ? { fontFamily: '"Work Sans", system-ui, sans-serif' } : undefined}
          >
            {copy.header.brand}
          </span>
        </button>

        <nav
          className={
            useLandingChrome
              ? `hidden min-w-0 items-center lg:flex ${
                  isAuthRoute
                    ? `col-start-2 row-start-1 justify-self-start lg:ml-36 xl:ml-40 ${
                        marketingShellCompact ? 'gap-4 lg:gap-5 xl:gap-6' : 'gap-5 lg:gap-6 xl:gap-7'
                      }`
                    : `col-start-2 row-start-1 justify-center justify-self-center lg:-translate-x-4 xl:-translate-x-5 ${
                        marketingShellCompact ? 'gap-4 lg:gap-5 xl:gap-6' : 'gap-5 lg:gap-6 xl:gap-7'
                      }`
                }`
              : 'hidden items-center gap-2 lg:flex'
          }
        >
          {isAppRoute && isAuthenticated ? (
            isOnboardingAppRoute ? (
              onboardingAppLinks.map((item) => {
                const isActive = route === item.route

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`inline-flex items-center justify-center text-[0.82rem] font-semibold transition-all duration-300 ${
                      isActive
                        ? 'text-[#8b4214]'
                        : 'text-[#7d6957] hover:text-[#eb7a1c] dark:text-[#e7d4c0] dark:hover:text-[#f29a40]'
                    }`}
                    style={{ fontFamily: '"Work Sans", system-ui, sans-serif' }}
                    onClick={() => onNavigate(item.route)}
                  >
                    {item.label}
                  </button>
                )
              })
            ) : currentViewLabel ? (
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-4 text-xs font-bold uppercase tracking-[0.16em] text-text-silver-light dark:border-border-dark dark:bg-bg-dark/55 dark:text-text-silver-dark">
                <span className="size-2 rounded-full bg-primary"></span>
                <span>{currentViewLabel}</span>
              </div>
            ) : null
          ) : (
            marketingLinks.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                className={`inline-flex items-center justify-center ${
                  useLandingChrome
                    ? `${marketingShellCompact ? 'text-[0.8rem] md:text-[0.83rem]' : 'text-[0.86rem]'} leading-tight tracking-normal font-bold ${
                        isAuthRoute
                          ? `${authHeaderLeftTextClass} hover:text-[#ffb15c]`
                          : 'text-[#1a1a1a] hover:text-[#ff8c00] dark:text-[#e7d4c0] dark:hover:text-[#f29a40]'
                      } transition-all duration-300`
                    : 'h-10 rounded-full px-4 text-xs font-bold uppercase tracking-[0.16em] text-text-silver-light transition hover:text-primary-dark dark:text-text-silver-dark dark:hover:text-primary'
                }`}
                style={useLandingChrome ? { fontFamily: '"Work Sans", system-ui, sans-serif' } : undefined}
                onClick={() => onScrollToSection(item.sectionId)}
              >
                {item.label}
              </button>
            ))
          )}
        </nav>

        <div
          className={`min-w-0 justify-self-end flex items-center transition-all duration-300 md:translate-y-[1px] ${
            isLandingCompact
              ? 'gap-1 md:gap-1.5 lg:gap-2 xl:gap-3'
              : 'gap-1 md:gap-2 lg:gap-2.5 xl:gap-3.5'
          }`}
        >
          <button
            type="button"
            onClick={(event) => toggleTheme(event)}
            aria-label={copy.header.themeLabel}
            className={`flex items-center justify-center rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-90 ${
              useLandingChrome
                ? `${marketingShellCompact ? 'size-[1.5rem]' : 'size-[1.625rem]'} ${
                    isAuthRoute
                      ? `${authHeaderRightTextClass} hover:bg-[#fff4e8] hover:text-[#ff8c00]`
                      : 'text-[#1a1a1a] hover:bg-[#fff4e8] hover:text-[#ff8c00] dark:text-[#f1dfca] dark:hover:bg-[#211710] dark:hover:text-[#f29a40]'
                  }`
                : 'size-9 text-text-silver-light hover:scale-110 hover:bg-black/5 hover:text-primary hover:shadow-[0_0_12px_rgba(212,175,55,0.3)] dark:text-text-silver-dark dark:hover:bg-white/5'
            }`}
          >
            <span
              className={`material-symbols-outlined transition-all duration-300 ${
                    marketingShellCompact ? 'text-[13px]' : 'text-[14px]'
              }`}
            >
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
              aria-label={copy.header.languageLabel}
              aria-haspopup="menu"
              aria-expanded={isLanguageMenuOpen}
              className={`flex items-center rounded-full px-3 text-xs font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                useLandingChrome
                  ? `${marketingShellCompact ? 'h-[1.8rem] gap-1 text-[0.72rem] md:text-[0.75rem]' : 'h-[1.95rem] gap-1 text-[0.78rem]'} leading-tight rounded-none border-0 bg-transparent px-0 font-bold ${
                      isAuthRoute
                        ? `${authHeaderRightTextClass} hover:text-[#ff8c00]`
                        : 'text-[#1a1a1a] hover:text-[#ff8c00] dark:text-[#f1dfca] dark:hover:text-[#f29a40]'
                    }`
                  : 'h-9 gap-2 border border-border-light text-text-charcoal hover:border-primary/40 hover:text-primary dark:border-border-dark dark:text-white'
              }`}
              style={useLandingChrome ? { fontFamily: '"Work Sans", system-ui, sans-serif' } : undefined}
            >
              {useLandingChrome ? (
                <span
                  className={`material-symbols-outlined transition-all duration-300 ${
                    marketingShellCompact ? 'text-[12px]' : 'text-[13px]'
                  }`}
                >
                  language
                </span>
              ) : null}
              <span className="hidden sm:block">{currentLanguage.label}</span>
              <span className="sm:hidden">{currentLanguage.code.toUpperCase()}</span>
              <span
                className={`material-symbols-outlined text-base transition-transform duration-200 ${
                  isLanguageMenuOpen ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>

            <div
              className={`absolute right-0 top-[calc(100%+0.65rem)] min-w-[11rem] overflow-hidden rounded-2xl border border-border-light/80 bg-surface-white/95 p-1 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark/80 dark:bg-surface-dark/95 ${
                isLanguageMenuOpen
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-1 opacity-0'
              }`}
              role="menu"
              aria-label={copy.header.languageLabel}
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
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[0.78rem] font-semibold leading-tight transition-colors ${
                      isActive
                        ? 'bg-primary/10 font-bold text-primary'
                        : 'text-text-silver-light hover:bg-black/5 hover:text-text-charcoal dark:text-text-silver-dark dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                    style={{ fontFamily: '"Work Sans", system-ui, sans-serif' }}
                  >
                    <span>{option.label}</span>
                    {isActive ? (
                      <span className="material-symbols-outlined text-base">check</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {isAuthenticated ? (
            <>
              <div className="relative" ref={accountMenuRef}>
                <button
                type="button"
                aria-label={productCopy.header.accountMenuLabel}
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
                  onClick={() => {
                    setIsAccountMenuOpen((current) => !current)
                    setIsLanguageMenuOpen(false)
                  }}
                  className={`group flex min-w-0 items-center overflow-hidden rounded-full text-left transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    useLandingChrome
                      ? `${isOnboardingAppRoute ? 'h-11 max-w-[15rem] gap-2.5 pl-1.5 pr-3 sm:max-w-[16.75rem]' : marketingShellCompact ? 'h-9 max-w-[14.5rem] gap-2 pl-1.5 pr-3 lg:max-w-[15.75rem]' : 'h-10 max-w-[16rem] gap-2.5 pl-2 pr-3.5 lg:max-w-[17.75rem]'} border border-[#eadbc8] bg-white/78 hover:border-[#eb7a1c]/40 hover:bg-white dark:border-[#3d2c1f] dark:bg-[#1c140f]/88 dark:hover:border-[#f29a40]/45 dark:hover:bg-[#241912]`
                      : 'h-10 gap-2 border border-border-light/80 bg-surface-white/70 hover:border-primary/35 hover:bg-primary/6 dark:border-border-dark dark:bg-surface-dark/78'
                  }`}
                >
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-bg-dark transition-all duration-300 ${
                      isOnboardingAppRoute
                        ? 'size-[1.85rem] text-[11px]'
                        : isLandingCompact
                          ? 'size-[1.625rem]'
                          : 'size-7'
                    }`}
                  >
                    {user?.initials ?? 'S'}
                  </span>
                  <span
                    className={`hidden min-w-0 flex-1 md:block ${
                      useLandingChrome
                        ? isOnboardingAppRoute
                          ? 'max-w-[9.9rem] lg:max-w-[11.3rem]'
                          : marketingShellCompact
                            ? 'max-w-[9.1rem] lg:max-w-[10.35rem]'
                            : 'max-w-[10.45rem] lg:max-w-[12rem]'
                        : ''
                    }`}
                  >
                    <span
                      className={`block truncate font-semibold ${
                        useLandingChrome
                          ? isOnboardingAppRoute
                            ? 'text-[0.9rem] leading-tight'
                            : marketingShellCompact
                              ? 'text-[0.84rem] leading-tight'
                              : 'text-[0.92rem] leading-tight'
                          : 'text-sm'
                      } ${
                        useLandingChrome ? 'text-[#201611] dark:text-[#fff7ef]' : 'text-text-charcoal dark:text-white'
                      }`}
                    >
                      {user?.displayName ?? productCopy.header.accountFallback}
                    </span>
                    <span
                      className={`block truncate ${
                        useLandingChrome
                          ? isOnboardingAppRoute
                            ? 'mt-0.5 text-[11px] leading-tight'
                            : 'mt-0.5 text-[11px] leading-tight'
                          : 'text-[12px]'
                      } ${
                        useLandingChrome ? 'text-[#7a6958] dark:text-[#cdb69c]' : 'text-text-silver-light dark:text-text-silver-dark'
                      }`}
                    >
                      {restaurantLabel ?? productCopy.header.protectedAccess}
                    </span>
                  </span>
                  <span
                    className={`material-symbols-outlined ml-1.5 shrink-0 text-base transition-transform duration-200 ${
                      useLandingChrome
                        ? `text-[#7a6958] group-hover:text-[#c95b14] dark:text-[#cdb69c] dark:group-hover:text-[#f29a40] ${isAccountMenuOpen ? 'rotate-180' : ''}`
                        : `text-text-silver-light group-hover:text-primary dark:text-text-silver-dark ${isAccountMenuOpen ? 'rotate-180' : ''}`
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                <div
                  className={`absolute right-0 top-[calc(100%+0.8rem)] w-[min(22rem,calc(100vw-2rem))] rounded-[1.5rem] border border-border-light/80 bg-surface-white/96 p-2 shadow-[0_22px_50px_-22px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark/80 dark:bg-[#19150f]/96 ${
                    isAccountMenuOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-1 opacity-0'
                  }`}
                  role="menu"
                  aria-label={productCopy.header.accountMenuLabel}
                >
                  <div className="rounded-[1.1rem] border border-border-light/80 bg-bg-light/70 p-4 dark:border-border-dark dark:bg-bg-dark/50">
                    <div className="flex items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-bg-dark">
                        {user?.initials ?? 'S'}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-text-charcoal dark:text-white">
                          {user?.displayName ?? productCopy.header.accountFallback}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-text-silver-light dark:text-text-silver-dark">
                          {productCopy.header.signedInAs}
                        </div>
                        <div className="mt-1 truncate text-sm text-text-silver-light dark:text-text-silver-dark">
                          {user?.email ?? ''}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
                            {productCopy.header.protectedAccess}
                          </span>
                          {restaurantLabel ? (
                            <span className="rounded-full border border-border-light bg-surface-white px-3 py-1.5 text-[12px] font-semibold text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
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
                        className="flex h-11 items-center rounded-xl px-3 text-left text-sm font-semibold text-text-charcoal transition hover:bg-primary/8 hover:text-primary dark:text-white dark:hover:bg-white/5"
                        onClick={() => {
                          setIsAccountMenuOpen(false)
                          action.onClick()
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  {accountActions.length ? <MenuDivider /> : null}

                  <button
                    type="button"
                    role="menuitem"
                    className="flex h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                    onClick={() => {
                      setIsAccountMenuOpen(false)
                      onLogout()
                    }}
                  >
                    {productCopy.header.logout}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`hidden items-center justify-center rounded-full px-2 text-xs font-bold transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex ${
                  useLandingChrome
                    ? `${marketingShellCompact ? 'h-[1.8rem] text-[0.72rem] md:text-[0.75rem]' : 'h-[1.95rem] text-[0.78rem]'} leading-tight rounded-none px-0 font-bold ${
                        isAuthRoute
                          ? `${authHeaderRightTextClass} hover:text-[#ff8c00]`
                          : 'text-[#1a1a1a] hover:text-[#ff8c00] dark:text-[#f1dfca] dark:hover:text-[#f29a40]'
                      }`
                    : 'h-9 text-text-charcoal hover:text-primary-dark dark:text-white dark:hover:text-primary'
                }`}
                style={useLandingChrome ? { fontFamily: '"Work Sans", system-ui, sans-serif' } : undefined}
                onClick={() => onNavigate('/login')}
              >
                {productCopy.header.login}
              </button>
              <button
                type="button"
                className={`flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-xs font-bold transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  useLandingChrome
                    ? `${marketingShellCompact ? 'h-[1.9rem] min-w-[6.4rem] px-3.5 text-[0.72rem] md:text-[0.75rem] shadow-[0_10px_24px_-16px_rgba(255,140,0,0.35)]' : 'h-[2.05rem] min-w-[6.7rem] px-3.75 text-[0.78rem] shadow-[0_12px_28px_-18px_rgba(255,140,0,0.4)]'} leading-tight bg-[#ff8c00] font-bold text-white hover:bg-[#e67e00] dark:bg-[#f29a40] dark:text-[#1b120c] dark:shadow-[0_14px_30px_-18px_rgba(242,154,64,0.35)] dark:hover:bg-[#ffad57]`
                    : 'h-9 bg-primary text-white shadow-[0_4px_14px_rgba(212,175,55,0.4)] hover:bg-primary-dark hover:shadow-[0_6px_20px_rgba(212,175,55,0.6)] dark:text-bg-dark dark:hover:bg-yellow-400'
                }`}
                style={useLandingChrome ? { fontFamily: '"Work Sans", system-ui, sans-serif' } : undefined}
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
