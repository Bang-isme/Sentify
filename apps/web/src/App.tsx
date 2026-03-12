import { useEffect, useEffectEvent, useState } from 'react'
import './index.css'
import { AuthScreen } from './components/product/AuthScreen'
import { ProductWorkspace } from './components/product/ProductWorkspace'
import { LandingPage } from './components/landing/LandingPage'
import { Header } from './components/layout/Header'
import { getProductUiCopy } from './content/productUiCopy'
import { LanguageProvider } from './contexts/LanguageProvider'
import { useLanguage } from './contexts/languageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import {
  ApiClientError,
  createRestaurant,
  getComplaintKeywords,
  getDashboardKpi,
  getLatestImportRun,
  listImportRuns,
  getSession,
  getRestaurantDetail,
  getSentimentBreakdown,
  getTrend,
  importReviews,
  listRestaurants,
  listReviewEvidence,
  login,
  logout,
  register,
  updateRestaurant,
  type RestaurantDetail,
  type RestaurantMembership,
  type ReviewListResponse,
  type ReviewsQuery,
  type TrendPeriod,
  type AuthUser,
  type ImportRunSummary,
} from './lib/api'

type AppRoute = '/' | '/login' | '/signup' | '/app' | '/app/reviews' | '/app/settings'

interface StoredSession {
  user: AuthUser
  restaurants: RestaurantMembership[]
  selectedRestaurantId: string | null
}

interface NoticeState {
  tone: 'error' | 'success'
  message: string
}

interface DashboardState {
  kpi: Awaited<ReturnType<typeof getDashboardKpi>> | null
  sentiment: Awaited<ReturnType<typeof getSentimentBreakdown>>
  trend: Awaited<ReturnType<typeof getTrend>>
  complaints: Awaited<ReturnType<typeof getComplaintKeywords>>
}

interface UserIdentityViewModel {
  displayName: string
  email: string
  initials: string
  restaurantCount: number
  selectedRestaurantName?: string
}

const SELECTED_RESTAURANT_STORAGE_KEY = 'sentify-selected-restaurant'
const EMPTY_DASHBOARD: DashboardState = {
  kpi: null,
  sentiment: [],
  trend: [],
  complaints: [],
}
const DEFAULT_REVIEW_FILTERS: ReviewsQuery = {
  page: 1,
  limit: 10,
}

function loadSelectedRestaurantId() {
  const raw = localStorage.getItem(SELECTED_RESTAURANT_STORAGE_KEY)?.trim()
  return raw || null
}

function getRouteFromHash(hash: string): AppRoute {
  if (!hash.startsWith('#/')) {
    return '/'
  }

  const candidate = hash.slice(1) as AppRoute

  switch (candidate) {
    case '/':
    case '/login':
    case '/signup':
    case '/app':
    case '/app/reviews':
    case '/app/settings':
      return candidate
    default:
      return '/'
  }
}

function isAppRoute(route: AppRoute): route is '/app' | '/app/reviews' | '/app/settings' {
  return route.startsWith('/app')
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

function SentifyShell() {
  const { language } = useLanguage()
  const productCopy = getProductUiCopy(language)
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromHash(window.location.hash))
  const [session, setSession] = useState<StoredSession | null>(null)
  const [authBootLoading, setAuthBootLoading] = useState(true)
  const [sessionRefreshing, setSessionRefreshing] = useState(false)
  const [sessionSyncKey, setSessionSyncKey] = useState(0)
  const [authPending, setAuthPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [restaurantDetail, setRestaurantDetail] = useState<RestaurantDetail | null>(null)
  const [restaurantLoading, setRestaurantLoading] = useState(false)
  const [restaurantError, setRestaurantError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardState>(EMPTY_DASHBOARD)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('week')
  const [importPending, setImportPending] = useState(false)
  const [createPending, setCreatePending] = useState(false)
  const [savePending, setSavePending] = useState(false)
  const [reviews, setReviews] = useState<ReviewListResponse | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviewFilters, setReviewFilters] = useState<ReviewsQuery>(DEFAULT_REVIEW_FILTERS)
  const [latestImportRun, setLatestImportRun] = useState<ImportRunSummary | null>(null)
  const [importRuns, setImportRuns] = useState<ImportRunSummary[]>([])
  const [importRunsLoading, setImportRunsLoading] = useState(false)
  const [importRunsError, setImportRunsError] = useState<string | null>(null)

  const restaurants = session?.restaurants ?? []
  const selectedRestaurantId = session?.selectedRestaurantId ?? null
  const isAuthenticated = Boolean(session)
  const selectedRestaurantName =
    restaurantDetail?.name ??
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)?.name ??
    undefined
  const displayName = getUserDisplayName(session?.user, productCopy.header.accountFallback)
  const accountIdentity: UserIdentityViewModel | null = session
    ? {
        displayName,
        email: session.user.email,
        initials: getUserInitials(displayName, session.user.email),
        restaurantCount: restaurants.length,
        selectedRestaurantName,
      }
    : null

  function persistSession(nextSession: StoredSession | null) {
    setSession(nextSession)
  }

  function navigate(nextRoute: AppRoute) {
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
  }

  function scrollToSection(sectionId: string) {
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

  function expireSessionToLogin() {
    persistSession(null)
    setRestaurantDetail(null)
    setDashboard(EMPTY_DASHBOARD)
    setReviews(null)
    setRestaurantError(null)
    setDashboardError(null)
    setReviewsError(null)
    setNotice({
      tone: 'error',
      message: productCopy.feedback.sessionExpired,
    })
    navigate('/login')
  }

  function handleSessionExpiry(error: unknown) {
    if (error instanceof ApiClientError && error.status === 401) {
      expireSessionToLogin()
      return true
    }

    return false
  }

  async function waitForImportRunToFinish(restaurantId: string, runId: string) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < 8 * 60 * 1000) {
      const latestRun = await getLatestImportRun(restaurantId)

      if (!latestRun || latestRun.id !== runId) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500))
        continue
      }

      setLatestImportRun(latestRun)
      setImportRuns((current) => {
        const remainingRuns = current.filter((run) => run.id !== latestRun.id)
        return [latestRun, ...remainingRuns].slice(0, 6)
      })

      if (latestRun.status === 'COMPLETED') {
        return latestRun
      }

      if (latestRun.status === 'FAILED') {
        throw new Error(latestRun.errorMessage || latestRun.message || productCopy.feedback.errors.importReviews)
      }

      await new Promise((resolve) => window.setTimeout(resolve, 2500))
    }

    throw new Error(productCopy.feedback.errors.importReviews)
  }

  const handleEffectSessionExpiry = useEffectEvent((error: unknown) => handleSessionExpiry(error))
  const getFeedbackError = useEffectEvent(
    (kind: keyof typeof productCopy.feedback.errors) => productCopy.feedback.errors[kind],
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
          selectedRestaurantId: getSafeSelectedRestaurantId(
            memberships,
            loadSelectedRestaurantId(),
          ),
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!(error instanceof ApiClientError && error.status === 401)) {
          setNotice({
            tone: 'error',
            message: getErrorMessage(error, getFeedbackError('refreshSession')),
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
  }, [])

  useEffect(() => {
    if (selectedRestaurantId) {
      localStorage.setItem(SELECTED_RESTAURANT_STORAGE_KEY, selectedRestaurantId)
      return
    }

    localStorage.removeItem(SELECTED_RESTAURANT_STORAGE_KEY)
  }, [selectedRestaurantId])

  useEffect(() => {
    if (!session?.user.id) {
      setSessionRefreshing(false)
      return
    }

    let cancelled = false

    async function hydrateSession() {
      setSessionRefreshing(true)

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
            selectedRestaurantId: getSafeSelectedRestaurantId(
              memberships,
              current.selectedRestaurantId,
            ),
          }
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!handleEffectSessionExpiry(error)) {
          setNotice({
            tone: 'error',
            message: getErrorMessage(error, getFeedbackError('refreshSession')),
          })
        }
      } finally {
        if (!cancelled) {
          setSessionRefreshing(false)
        }
      }
    }

    void hydrateSession()

    return () => {
      cancelled = true
    }
  }, [session?.user.id, sessionSyncKey])

  useEffect(() => {
    if (authBootLoading) {
      return
    }

    if (isAppRoute(route) && !session) {
      navigate('/login')
      return
    }

    if ((route === '/login' || route === '/signup') && session) {
      navigate('/app')
    }
  }, [route, session, authBootLoading])

  useEffect(() => {
    if (!session?.user.id || !selectedRestaurantId) {
      setRestaurantDetail(null)
      setRestaurantError(null)
      setRestaurantLoading(false)
      return
    }

    const restaurantId = selectedRestaurantId
    let cancelled = false

    async function loadRestaurantDetail() {
      setRestaurantLoading(true)
      setRestaurantError(null)

      try {
        const detail = await getRestaurantDetail(restaurantId)

        if (!cancelled) {
          setRestaurantDetail(detail)
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!handleEffectSessionExpiry(error)) {
          setRestaurantDetail(null)
          setRestaurantError(getErrorMessage(error, getFeedbackError('loadRestaurant')))
        }
      } finally {
        if (!cancelled) {
          setRestaurantLoading(false)
        }
      }
    }

    void loadRestaurantDetail()

    return () => {
      cancelled = true
    }
  }, [session?.user.id, selectedRestaurantId, sessionSyncKey])

  useEffect(() => {
    if (route !== '/app' || !session?.user.id || !selectedRestaurantId) {
      setDashboard(EMPTY_DASHBOARD)
      setDashboardError(null)
      setDashboardLoading(false)
      return
    }

    const restaurantId = selectedRestaurantId
    let cancelled = false

    async function loadDashboard() {
      setDashboardLoading(true)
      setDashboardError(null)

      try {
        const [kpi, sentiment, trend, complaints] = await Promise.all([
          getDashboardKpi(restaurantId),
          getSentimentBreakdown(restaurantId),
          getTrend(restaurantId, trendPeriod),
          getComplaintKeywords(restaurantId),
        ])

        if (!cancelled) {
          setDashboard({
            kpi,
            sentiment,
            trend,
            complaints,
          })
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!handleEffectSessionExpiry(error)) {
          setDashboard(EMPTY_DASHBOARD)
          setDashboardError(getErrorMessage(error, getFeedbackError('loadDashboard')))
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [session?.user.id, route, selectedRestaurantId, sessionSyncKey, trendPeriod])

  useEffect(() => {
    if (route !== '/app/reviews' || !session?.user.id || !selectedRestaurantId) {
      setReviews(null)
      setReviewsError(null)
      setReviewsLoading(false)
      return
    }

    const restaurantId = selectedRestaurantId
    let cancelled = false

    async function loadReviewEvidence() {
      setReviewsLoading(true)
      setReviewsError(null)

      try {
        const result = await listReviewEvidence(restaurantId, reviewFilters)

        if (!cancelled) {
          setReviews(result)
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!handleEffectSessionExpiry(error)) {
          setReviews(null)
          setReviewsError(getErrorMessage(error, getFeedbackError('loadReviews')))
        }
      } finally {
        if (!cancelled) {
          setReviewsLoading(false)
        }
      }
    }

    void loadReviewEvidence()

    return () => {
      cancelled = true
    }
  }, [session?.user.id, route, reviewFilters, selectedRestaurantId, sessionSyncKey])

  useEffect(() => {
    if (!session?.user.id || !selectedRestaurantId) {
      setLatestImportRun(null)
      setImportRuns([])
      setImportRunsError(null)
      setImportRunsLoading(false)
      return
    }

    const restaurantId = selectedRestaurantId
    let cancelled = false

    async function loadImportRuns() {
      setImportRunsLoading(true)
      setImportRunsError(null)

      try {
        const [latestRun, history] = await Promise.all([
          getLatestImportRun(restaurantId),
          listImportRuns(restaurantId),
        ])

        if (!cancelled) {
          setLatestImportRun(latestRun)
          setImportRuns(history)
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        if (!handleEffectSessionExpiry(error)) {
          setLatestImportRun(null)
          setImportRuns([])
          setImportRunsError(getErrorMessage(error, getFeedbackError('loadDashboard')))
        }
      } finally {
        if (!cancelled) {
          setImportRunsLoading(false)
        }
      }
    }

    void loadImportRuns()

    return () => {
      cancelled = true
    }
  }, [session?.user.id, selectedRestaurantId, sessionSyncKey])

  useEffect(() => {
    if (!session?.user.id || !selectedRestaurantId || !isAppRoute(route)) {
      return
    }

    if (!latestImportRun || (latestImportRun.status !== 'QUEUED' && latestImportRun.status !== 'RUNNING')) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const [latestRun, history] = await Promise.all([
            getLatestImportRun(selectedRestaurantId),
            listImportRuns(selectedRestaurantId),
          ])

          if (!cancelled) {
            setLatestImportRun(latestRun)
            setImportRuns(history)
          }
        } catch (error) {
          if (cancelled) {
            return
          }

          if (!handleEffectSessionExpiry(error)) {
            setImportRunsError(getErrorMessage(error, getFeedbackError('loadDashboard')))
          }
        }
      })()
    }, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    session?.user.id,
    route,
    selectedRestaurantId,
    latestImportRun,
    latestImportRun?.id,
    latestImportRun?.status,
    latestImportRun?.updatedAt,
  ])

  async function handleLogin(input: { email: string; password: string }) {
    setAuthPending(true)
    setAuthError(null)

    try {
      const result = await login(input)
      const memberships = result.user.restaurants ?? []
      const nextSession: StoredSession = {
        user: result.user,
        restaurants: memberships,
        selectedRestaurantId: getSafeSelectedRestaurantId(memberships, null),
      }

      persistSession(nextSession)
      setSessionSyncKey((current) => current + 1)
      navigate('/app')
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
      const nextSession: StoredSession = {
        user: result.user,
        restaurants: [],
        selectedRestaurantId: null,
      }

      persistSession(nextSession)
      navigate('/app')
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
      // Clear the client session even if the server-side revoke request fails.
    }

    persistSession(null)
    setRestaurantDetail(null)
    setDashboard(EMPTY_DASHBOARD)
    setReviews(null)
    setReviewFilters(DEFAULT_REVIEW_FILTERS)
    setTrendPeriod('week')
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

      setSessionSyncKey((current) => current + 1)
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

      setRestaurantDetail(updated)
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
                  permission: updated.permission,
                  googleMapUrl: updated.googleMapUrl,
                }
              : restaurant,
          ),
        }
      })
      setSessionSyncKey((current) => current + 1)
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

  async function handleImportReviews() {
    if (!session?.user.id || !selectedRestaurantId) {
      return
    }

    setImportPending(true)

    try {
      const result = await importReviews(selectedRestaurantId)

      if (!result.run) {
        throw new Error(result.message || productCopy.feedback.errors.importReviews)
      }

      setLatestImportRun(result.run)
      setImportRuns((current) => {
        const remainingRuns = current.filter((run) => run.id !== result.run?.id)
        return result.run ? [result.run, ...remainingRuns].slice(0, 6) : current
      })

      setNotice({
        tone: 'success',
        message: result.message || productCopy.feedback.imported,
      })

      const completedRun =
        result.run.status === 'COMPLETED'
          ? result.run
          : await waitForImportRunToFinish(selectedRestaurantId, result.run.id)

      setSessionSyncKey((current) => current + 1)
      setNotice({
        tone: 'success',
        message: completedRun.message || productCopy.feedback.imported,
      })
    } catch (error) {
      if (!handleSessionExpiry(error)) {
        setNotice({
          tone: 'error',
          message: getErrorMessage(error, productCopy.feedback.errors.importReviews),
        })
      }
    } finally {
      setImportPending(false)
    }
  }

  function handleSelectRestaurant(restaurantId: string) {
    setSession((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedRestaurantId: restaurantId,
      }
    })
  }

  function handleApplyReviewFilters(filters: ReviewsQuery) {
    setReviewFilters(filters)
  }

  function handleClearReviewFilters() {
    setReviewFilters(DEFAULT_REVIEW_FILTERS)
  }

  function handleReviewPageChange(page: number) {
    setReviewFilters((current) => ({
      ...current,
      page: Math.max(page, 1),
    }))
  }

  const heroPrimaryLabel = isAuthenticated
    ? productCopy.landing.heroPrimaryAuthenticated
    : productCopy.landing.heroPrimary
  const heroSecondaryLabel = isAuthenticated
    ? productCopy.landing.heroSecondaryAuthenticated
    : productCopy.landing.ctaPrimaryAuthenticated
  const ctaPrimaryLabel = isAuthenticated
    ? productCopy.landing.ctaPrimaryAuthenticated
    : productCopy.landing.ctaPrimary
  const ctaSecondaryLabel = isAuthenticated
    ? productCopy.landing.ctaSecondaryAuthenticated
    : productCopy.landing.ctaSecondary

  return (
    <div className="bg-bg-light font-display text-text-charcoal transition-colors duration-300 dark:bg-bg-dark dark:text-white">
      <Header
        route={route}
        isAuthenticated={isAuthenticated}
        user={accountIdentity}
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
          className="flex min-h-screen items-center justify-center bg-bg-light px-6 pt-28 pb-14 dark:bg-bg-dark"
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
      ) : isAppRoute(route) ? (
        <ProductWorkspace
          route={route}
          copy={productCopy.app}
          restaurants={restaurants}
          selectedRestaurantId={selectedRestaurantId}
          selectedRestaurantDetail={restaurantDetail}
          restaurantLoading={restaurantLoading || sessionRefreshing}
          restaurantError={restaurantError}
          dashboard={dashboard}
          dashboardLoading={dashboardLoading}
          dashboardError={dashboardError}
          trendPeriod={trendPeriod}
          onTrendPeriodChange={setTrendPeriod}
          importPending={importPending}
          savePending={savePending}
          createPending={createPending}
          reviews={reviews}
          reviewsLoading={reviewsLoading}
          reviewsError={reviewsError}
          latestImportRun={latestImportRun}
          importRuns={importRuns}
          importRunsLoading={importRunsLoading}
          importRunsError={importRunsError}
          reviewFilters={reviewFilters}
          onApplyReviewFilters={handleApplyReviewFilters}
          onClearReviewFilters={handleClearReviewFilters}
          onReviewPageChange={handleReviewPageChange}
          onSelectRestaurant={handleSelectRestaurant}
          onNavigate={navigate}
          onCreateRestaurant={handleCreateRestaurant}
          onSaveRestaurant={handleSaveRestaurant}
          onImportReviews={handleImportReviews}
        />
      ) : (
        <LandingPage
          heroPrimaryLabel={heroPrimaryLabel}
          heroSecondaryLabel={heroSecondaryLabel}
          ctaPrimaryLabel={ctaPrimaryLabel}
          ctaSecondaryLabel={ctaSecondaryLabel}
          onHeroPrimaryAction={() => {
            if (isAuthenticated) {
              navigate('/app')
              return
            }

            navigate('/signup')
          }}
          onHeroSecondaryAction={() => {
            if (isAuthenticated) {
              scrollToSection('workflow')
              return
            }

            navigate('/app')
          }}
          onCtaPrimaryAction={() => {
            if (isAuthenticated) {
              navigate('/app')
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

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <SentifyShell />
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App
