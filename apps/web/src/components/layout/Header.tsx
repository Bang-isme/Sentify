import { useEffect, useMemo, useRef, useState } from 'react'
import { getProductUiCopy } from '../../content/productUiCopy'
import { LANGUAGE_OPTIONS, useLanguage } from '../../contexts/languageContext'
import { useTheme } from '../../contexts/useTheme'

type HeaderRoute = '/' | '/login' | '/signup' | '/app' | '/app/reviews' | '/app/settings'

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
  const [isCompact, setIsCompact] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const lastScrollY = useRef(0)
  const scrollTicking = useRef(false)

  const currentLanguage =
    LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0]
  const isAppRoute = route.startsWith('/app')
  const currentViewLabel =
    route === '/app'
      ? productCopy.header.dashboard
      : route === '/app/reviews'
        ? productCopy.header.reviews
        : route === '/app/settings'
          ? productCopy.header.settings
          : null

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
    const shouldAutoHide = route === '/'

    if (!shouldAutoHide) {
      setIsHidden(false)
      setIsCompact(false)
      return undefined
    }

    lastScrollY.current = window.scrollY

    function onScroll() {
      if (scrollTicking.current) {
        return
      }

      scrollTicking.current = true

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY
        const delta = currentY - lastScrollY.current
        const shouldHide = currentY > 140 && delta > 6
        const shouldShow = delta < -6 || currentY < 90

        setIsCompact(currentY > 12)
        setIsHidden((prev) => (shouldHide ? true : shouldShow ? false : prev))
        lastScrollY.current = currentY
        scrollTicking.current = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [route])

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

  return (
    <header
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center transition-transform duration-300 ease-out ${
        isHidden ? '-translate-y-24' : 'translate-y-0'
      } ${isCompact ? 'top-2 md:top-3' : 'top-4 md:top-5'}`}
    >
      <div
        className={`pointer-events-auto mx-4 flex w-full max-w-[1260px] items-center gap-3 rounded-full border border-border-light/70 bg-surface-white/90 px-4 shadow-[0_10px_34px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300 hover:border-primary/30 dark:border-border-dark/70 dark:bg-surface-dark/92 dark:shadow-[0_10px_34px_rgba(0,0,0,0.5)] md:px-6 ${
          isCompact ? 'min-h-14 md:min-h-16' : 'min-h-16 md:min-h-[4.5rem]'
        }`}
      >
        <button
          type="button"
          className="group mr-2 flex shrink-0 items-center gap-3"
          onClick={() => {
            if (isAuthenticated) {
              onNavigate('/app')
              return
            }

            onScrollToSection('overview')
          }}
        >
          <div className="flex size-9 items-center justify-center rounded-full border border-primary/25 bg-primary/8 text-primary transition-transform duration-500 group-hover:rotate-180">
            <span className="material-symbols-outlined text-[20px]">token</span>
          </div>
          <span className="hidden text-lg font-bold tracking-tight text-text-charcoal dark:text-white sm:block">
            {copy.header.brand}
          </span>
        </button>

        <nav className="hidden items-center gap-2 lg:flex">
          {isAppRoute && isAuthenticated ? (
            currentViewLabel ? (
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-4 text-xs font-bold uppercase tracking-[0.16em] text-text-silver-light dark:border-border-dark dark:bg-bg-dark/55 dark:text-text-silver-dark">
                <span className="size-2 rounded-full bg-primary"></span>
                <span>{currentViewLabel}</span>
              </div>
            ) : null
          ) : (
            productCopy.header.marketingLinks.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-[0.16em] text-text-silver-light transition hover:text-primary-dark dark:text-text-silver-dark dark:hover:text-primary"
                onClick={() => onScrollToSection(item.sectionId)}
              >
                {item.label}
              </button>
            ))
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={(event) => toggleTheme(event)}
            aria-label={copy.header.themeLabel}
            className="flex size-9 items-center justify-center rounded-full text-text-silver-light transition-all duration-200 hover:scale-110 hover:bg-black/5 hover:text-primary hover:shadow-[0_0_12px_rgba(212,175,55,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-90 dark:text-text-silver-dark dark:hover:bg-white/5"
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
              aria-label={copy.header.languageLabel}
              aria-haspopup="menu"
              aria-expanded={isLanguageMenuOpen}
              className="flex h-9 items-center gap-2 rounded-full border border-border-light px-3 text-xs font-bold text-text-charcoal transition-all duration-200 hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-border-dark dark:text-white"
            >
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
              className={`absolute right-0 top-[calc(100%+0.65rem)] min-w-[10rem] overflow-hidden rounded-2xl border border-border-light/80 bg-surface-white/95 p-1 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark/80 dark:bg-surface-dark/95 ${
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
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-text-silver-light hover:bg-black/5 hover:text-text-charcoal dark:text-text-silver-dark dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
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
                  className="group flex h-10 items-center gap-2 rounded-full border border-border-light/80 bg-surface-white/70 pl-2 pr-3 text-left transition hover:border-primary/35 hover:bg-primary/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-border-dark dark:bg-surface-dark/78"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-black text-bg-dark">
                    {user?.initials ?? 'S'}
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-sm font-semibold text-text-charcoal dark:text-white">
                      {user?.displayName ?? productCopy.header.accountFallback}
                    </span>
                    <span className="block truncate text-[11px] text-text-silver-light dark:text-text-silver-dark">
                      {restaurantLabel ?? productCopy.header.protectedAccess}
                    </span>
                  </span>
                  <span
                    className={`material-symbols-outlined text-base text-text-silver-light transition-transform duration-200 group-hover:text-primary dark:text-text-silver-dark ${
                      isAccountMenuOpen ? 'rotate-180' : ''
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
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark">
                          {productCopy.header.signedInAs}
                        </div>
                        <div className="mt-1 truncate text-xs text-text-silver-light dark:text-text-silver-dark">
                          {user?.email ?? ''}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                            {productCopy.header.protectedAccess}
                          </span>
                          {restaurantLabel ? (
                            <span className="rounded-full border border-border-light bg-surface-white px-3 py-1 text-[11px] font-semibold text-text-charcoal dark:border-border-dark dark:bg-surface-dark dark:text-white">
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
                className="hidden h-9 items-center justify-center rounded-full px-2 text-xs font-bold text-text-charcoal transition-colors hover:text-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex dark:text-white dark:hover:text-primary"
                onClick={() => onNavigate('/login')}
              >
                {productCopy.header.login}
              </button>
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-white shadow-[0_4px_14px_rgba(212,175,55,0.4)] transition-colors hover:bg-primary-dark hover:shadow-[0_6px_20px_rgba(212,175,55,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-bg-dark dark:hover:bg-yellow-400"
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
