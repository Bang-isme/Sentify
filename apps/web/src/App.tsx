import { useCallback, useEffect, useState } from 'react'
import './index.css'
import { AuthScreen } from './components/product/AuthScreen'
import { LandingPage } from './components/landing/LandingPage'
import { Header } from './components/layout/Header'
import { getProductUiCopy } from './content/productUiCopy'
import { LanguageProvider } from './contexts/LanguageProvider'
import { useLanguage } from './contexts/languageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AdminShell } from './features/admin-shell/AdminShell'
import {
  getAdminAccessDeniedMessage,
  getMerchantAccessDeniedMessage,
  getRoleDescriptor,
  isAdminRole,
} from './features/access/restaurantAccess'
import {
  getRouteFromHash,
  isAdminRoute,
  isMerchantRoute,
  isProtectedRoute,
  type AppRoute,
} from './features/app-shell/routes'
import { MerchantShell } from './features/merchant-shell/MerchantShell'
import {
  ApiClientError,
  createRestaurant,
  getSession,
  listRestaurants,
  login,
  logout,
  register,
  updateRestaurant,
  type AuthUser,
  type RestaurantMembership,
} from './lib/api'

interface StoredSession {
  user: AuthUser
  restaurants: RestaurantMembership[]
  selectedRestaurantId: string | null
}

interface NoticeState {
  tone: 'error' | 'success'
  message: string
}

interface UserIdentityViewModel {
  displayName: string
  email: string
  initials: string
  restaurantCount: number
  selectedRestaurantName?: string
  roleLabel: string
}

const SELECTED_RESTAURANT_STORAGE_KEY = 'sentify-selected-restaurant'

function loadSelectedRestaurantId() {
  const raw = localStorage.getItem(SELECTED_RESTAURANT_STORAGE_KEY)?.trim()
  return raw || null
}

function getSafeSelectedRestaurantId(
  restaurants: RestaurantMembership[],
  selectedRestaurantId: string | null,
) {
  if (selectedRestaurantId && restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
    return selectedRestaurantId
  }

  return restaurants[0]?.id ?? null
}

function getCurrentRestaurantMembership(
  restaurants: RestaurantMembership[],
  selectedRestaurantId: string | null,
) {
  if (selectedRestaurantId) {
    const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)

    if (selectedRestaurant) {
      return selectedRestaurant
    }
  }

  return restaurants[0] ?? null
}

function getUserDisplayName(user: AuthUser | undefined, fallback: string) {
  const trimmedName = user?.fullName?.trim()

  if (trimmedName) {
    return trimmedName
  }

  const emailPrefix = user?.email?.split('@')[0]?.trim()

  if (emailPrefix) {
    return emailPrefix
  }

  return fallback
}

function getUserInitials(displayName: string, email: string | undefined) {
  const words = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  const derived = words.map((word) => word[0]?.toUpperCase() ?? '').join('')

  if (derived) {
    return derived
  }

  return email?.trim()?.[0]?.toUpperCase() ?? 'S'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function getDefaultAuthenticatedRoute(user: AuthUser | undefined): AppRoute {
  return isAdminRole(user?.role) ? '/admin' : '/app'
}

function SentifyShell() {
  const { language } = useLanguage()
  const productCopy = getProductUiCopy(language)
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromHash(window.location.hash))
  const [session, setSession] = useState<StoredSession | null>(null)
  const [authBootLoading, setAuthBootLoading] = useState(true)
  const [authPending, setAuthPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createPending, setCreatePending] = useState(false)
  const [savePending, setSavePending] = useState(false)

  const restaurants = session?.restaurants ?? []
  const selectedRestaurantId = session?.selectedRestaurantId ?? null
  const currentRestaurantMembership = getCurrentRestaurantMembership(restaurants, selectedRestaurantId)
  const isAuthenticated = Boolean(session)
  const hasAdminControl = isAdminRole(session?.user.role)
  const homeRoute = getDefaultAuthenticatedRoute(session?.user)
  const roleDescriptor = getRoleDescriptor(session?.user.role, language)
  const displayName = getUserDisplayName(session?.user, productCopy.header.accountFallback)
  const accountIdentity: UserIdentityViewModel | null = session
    ? {
        displayName,
        email: session.user.email,
        initials: getUserInitials(displayName, session.user.email),
        restaurantCount: restaurants.length,
        selectedRestaurantName: currentRestaurantMembership?.name,
        roleLabel: roleDescriptor.label,
      }
    : null

  const persistSession = useCallback((nextSession: StoredSession | null) => {
    setSession(nextSession)
  }, [])

  const navigate = useCallback((nextRoute: AppRoute) => {
    if (nextRoute === '/') {
      if (window.location.hash) {
        window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
      }
      setRoute('/')
    } else {
      const nextHash = `#${nextRoute}`

      if (window.location.hash !== nextHash) {
        window.location.hash = nextRoute
      }

      setRoute(nextRoute)
    }

    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const scrollToSection = useCallback((sectionId: string) => {
    if (sectionId === 'overview') {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
      setRoute('/')
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      return
    }

    window.location.hash = sectionId
    setRoute('/')

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    })
  }, [])

  const expireSessionToLogin = useCallback(() => {
    persistSession(null)
    setNotice({
      tone: 'error',
      message: productCopy.feedback.sessionExpired,
    })
    navigate('/login')
  }, [navigate, persistSession, productCopy.feedback.sessionExpired])

  const handleSessionExpiry = useCallback(
    (error: unknown) => {
      if (error instanceof ApiClientError && error.status === 401) {
        expireSessionToLogin()
        return true
      }

      return false
    },
    [expireSessionToLogin],
  )

  useEffect(() => {
    function syncRouteFromHash() {
      setRoute(getRouteFromHash(window.location.hash))
    }

    window.addEventListener('hashchange', syncRouteFromHash)
    window.addEventListener('popstate', syncRouteFromHash)

    return () => {
      window.removeEventListener('hashchange', syncRouteFromHash)
      window.removeEventListener('popstate', syncRouteFromHash)
    }
  }, [])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 4200)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      setAuthBootLoading(true)

      try {
        const result = await getSession()

        if (cancelled) {
          return
        }

        const memberships = result.user.restaurants ?? []
        persistSession({
          user: result.user,
          restaurants: memberships,
          selectedRestaurantId: getSafeSelectedRestaurantId(memberships, loadSelectedRestaurantId()),
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!(error instanceof ApiClientError && error.status === 401)) {
          setNotice({
            tone: 'error',
            message: getErrorMessage(error, productCopy.feedback.errors.refreshSession),
          })
        }
      } finally {
        if (!cancelled) {
          setAuthBootLoading(false)
        }
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [productCopy.feedback.errors.refreshSession, persistSession])

  useEffect(() => {
    if (selectedRestaurantId) {
      localStorage.setItem(SELECTED_RESTAURANT_STORAGE_KEY, selectedRestaurantId)
      return
    }

    localStorage.removeItem(SELECTED_RESTAURANT_STORAGE_KEY)
  }, [selectedRestaurantId])

  useEffect(() => {
    if (!session?.user.id || session.user.role !== 'USER') {
      return
    }

    let cancelled = false

    async function hydrateRestaurants() {
      try {
        const memberships = await listRestaurants()

        if (cancelled) {
          return
        }

        setSession((current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            restaurants: memberships,
            selectedRestaurantId: getSafeSelectedRestaurantId(memberships, current.selectedRestaurantId),
          }
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!handleSessionExpiry(error)) {
          setNotice({
            tone: 'error',
            message: getErrorMessage(error, productCopy.feedback.errors.refreshSession),
          })
        }
      }
    }

    void hydrateRestaurants()

    return () => {
      cancelled = true
    }
  }, [handleSessionExpiry, productCopy.feedback.errors.refreshSession, refreshKey, session?.user.id, session?.user.role])

  useEffect(() => {
    if (authBootLoading) {
      return
    }

    if (isProtectedRoute(route) && !session) {
      navigate('/login')
      return
    }

    if ((route === '/login' || route === '/signup') && session) {
      navigate(getDefaultAuthenticatedRoute(session.user))
    }
  }, [authBootLoading, navigate, route, session])

  useEffect(() => {
    if (!session) {
      return
    }

    if (isAdminRoute(route) && !hasAdminControl) {
      setNotice({
        tone: 'error',
        message: getAdminAccessDeniedMessage(language),
      })
      navigate('/app')
      return
    }

    if (isMerchantRoute(route) && hasAdminControl) {
      setNotice({
        tone: 'error',
        message: getMerchantAccessDeniedMessage(language),
      })
      navigate('/admin')
    }
  }, [hasAdminControl, language, navigate, route, session])

  async function handleLogin(input: { email: string; password: string }) {
    setAuthPending(true)
    setAuthError(null)

    try {
      const result = await login(input)
      const memberships = result.user.restaurants ?? []

      persistSession({
        user: result.user,
        restaurants: memberships,
        selectedRestaurantId: getSafeSelectedRestaurantId(memberships, null),
      })
      setRefreshKey((current) => current + 1)
      navigate(getDefaultAuthenticatedRoute(result.user))
    } catch (error) {
      setAuthError(getErrorMessage(error, productCopy.feedback.errors.login))
    } finally {
      setAuthPending(false)
    }
  }

  async function handleSignup(input: { fullName: string; email: string; password: string }) {
    setAuthPending(true)
    setAuthError(null)

    try {
      const result = await register(input)

      persistSession({
        user: result.user,
        restaurants: [],
        selectedRestaurantId: null,
      })
      navigate(getDefaultAuthenticatedRoute(result.user))
    } catch (error) {
      setAuthError(getErrorMessage(error, productCopy.feedback.errors.signup))
    } finally {
      setAuthPending(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // Clear client state even if server-side revoke fails.
    }

    persistSession(null)
    setAuthError(null)
    navigate('/')
  }

  async function handleCreateRestaurant(input: {
    name: string
    address?: string
    googleMapUrl?: string
  }) {
    if (!session?.user.id) {
      navigate('/login')
      return
    }

    setCreatePending(true)

    try {
      const created = await createRestaurant(input)

      setSession((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          restaurants: [created, ...current.restaurants],
          selectedRestaurantId: created.id,
        }
      })
      setRefreshKey((current) => current + 1)
      setNotice({
        tone: 'success',
        message: productCopy.feedback.saved,
      })
      navigate('/app')
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({
          tone: 'error',
          message: getErrorMessage(error, productCopy.feedback.errors.createRestaurant),
        })
      }
    } finally {
      setCreatePending(false)
    }
  }

  async function handleSaveRestaurant(input: {
    name?: string
    address?: string | null
    googleMapUrl?: string | null
  }) {
    if (!session?.user.id || !selectedRestaurantId) {
      return
    }

    setSavePending(true)

    try {
      const updated = await updateRestaurant(selectedRestaurantId, input)

      setSession((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          restaurants: current.restaurants.map((restaurant) =>
            restaurant.id === selectedRestaurantId
              ? {
                  ...restaurant,
                  name: updated.name,
                  slug: updated.slug,
                  googleMapUrl: updated.googleMapUrl,
                }
              : restaurant,
          ),
        }
      })
      setRefreshKey((current) => current + 1)
      setNotice({
        tone: 'success',
        message: productCopy.feedback.saved,
      })
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({
          tone: 'error',
          message: getErrorMessage(error, productCopy.feedback.errors.saveRestaurant),
        })
      }
    } finally {
      setSavePending(false)
    }
  }

  const heroPrimaryLabel = isAuthenticated
    ? productCopy.landing.heroPrimaryAuthenticated
    : productCopy.landing.heroPrimary
  const heroSecondaryLabel = isAuthenticated
    ? productCopy.landing.heroSecondaryAuthenticated
    : productCopy.landing.heroPrimaryAuthenticated
  const ctaPrimaryLabel = isAuthenticated
    ? productCopy.landing.ctaPrimaryAuthenticated
    : productCopy.landing.ctaPrimary
  const ctaSecondaryLabel = isAuthenticated
    ? productCopy.landing.ctaSecondaryAuthenticated
    : productCopy.landing.ctaSecondary
  const redirectingProtectedRoute = !authBootLoading && isProtectedRoute(route) && !session

  return (
    <div className="bg-bg-light font-display text-text-charcoal transition-colors duration-300 dark:bg-bg-dark dark:text-white">
      <Header
        route={route}
        isAuthenticated={isAuthenticated}
        user={accountIdentity}
        roleDescription={roleDescriptor.description}
        homeRoute={homeRoute}
        onNavigate={navigate}
        onScrollToSection={scrollToSection}
        onLogout={handleLogout}
      />

      {notice ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4">
          <div
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-full px-4 py-3 text-sm font-semibold shadow-[0_16px_50px_-30px_rgba(0,0,0,0.45)] ${
              notice.tone === 'success'
                ? 'bg-primary text-white dark:text-bg-dark'
                : 'bg-red-600 text-white'
            }`}
          >
            {notice.message}
          </div>
        </div>
      ) : null}

      {authBootLoading && route !== '/' ? (
        <main
          id="main-content"
          className="flex min-h-screen items-center justify-center bg-bg-light px-6 pb-14 pt-28 dark:bg-bg-dark"
        >
          <div className="rounded-[1.8rem] border border-border-light/70 bg-surface-white/88 px-6 py-5 text-sm font-semibold text-text-charcoal shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82 dark:text-white">
            {productCopy.feedback.loadingSession}
          </div>
        </main>
      ) : redirectingProtectedRoute ? (
        <main
          id="main-content"
          className="flex min-h-screen items-center justify-center bg-bg-light px-6 pb-14 pt-28 dark:bg-bg-dark"
        >
          <div className="rounded-[1.8rem] border border-border-light/70 bg-surface-white/88 px-6 py-5 text-sm font-semibold text-text-charcoal shadow-[0_20px_70px_-38px_rgba(0,0,0,0.35)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82 dark:text-white">
            {productCopy.feedback.loadingSession}
          </div>
        </main>
      ) : route === '/login' || route === '/signup' ? (
        <AuthScreen
          key={route}
          mode={route === '/login' ? 'login' : 'signup'}
          copy={productCopy.auth}
          pending={authPending}
          error={authError}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onSwitchMode={(mode) => navigate(mode === 'login' ? '/login' : '/signup')}
        />
      ) : isMerchantRoute(route) ? (
        <MerchantShell
          route={route}
          copy={productCopy.app}
          feedbackCopy={productCopy.feedback}
          language={language}
          restaurants={restaurants}
          selectedRestaurantId={selectedRestaurantId}
          refreshKey={refreshKey}
          createPending={createPending}
          savePending={savePending}
          onSelectRestaurant={(restaurantId) =>
            setSession((current) =>
              current
                ? {
                    ...current,
                    selectedRestaurantId: restaurantId,
                  }
                : current,
            )
          }
          onNavigate={navigate}
          onCreateRestaurant={handleCreateRestaurant}
          onSaveRestaurant={handleSaveRestaurant}
          onSessionExpiry={handleSessionExpiry}
        />
      ) : isAdminRoute(route) ? (
        <AdminShell
          route={route}
          copy={productCopy.app}
          feedbackCopy={productCopy.feedback}
          language={language}
          refreshKey={refreshKey}
          selectedRestaurantId={selectedRestaurantId}
          onSelectRestaurant={(restaurantId) =>
            setSession((current) =>
              current
                ? {
                    ...current,
                    selectedRestaurantId: restaurantId,
                  }
                : current,
            )
          }
          onNavigate={navigate}
          onSessionExpiry={handleSessionExpiry}
          onDataChanged={() => setRefreshKey((current) => current + 1)}
        />
      ) : (
        <LandingPage
          heroPrimaryLabel={heroPrimaryLabel}
          heroSecondaryLabel={heroSecondaryLabel}
          ctaPrimaryLabel={ctaPrimaryLabel}
          ctaSecondaryLabel={ctaSecondaryLabel}
          onHeroPrimaryAction={() => {
            if (isAuthenticated) {
              navigate(homeRoute)
              return
            }

            navigate('/signup')
          }}
          onHeroSecondaryAction={() => {
            if (isAuthenticated) {
              scrollToSection('workflow')
              return
            }

            navigate('/login')
          }}
          onCtaPrimaryAction={() => {
            if (isAuthenticated) {
              navigate(homeRoute)
              return
            }

            navigate('/signup')
          }}
          onCtaSecondaryAction={() => scrollToSection('workflow')}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SentifyShell />
      </LanguageProvider>
    </ThemeProvider>
  )
}
