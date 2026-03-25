export type PublicRoute = '/' | '/login' | '/signup'
export type MerchantRoute = '/app' | '/app/reviews' | '/app/settings'
export type AdminRoute = '/admin' | '/admin/intake' | '/admin/review-ops' | '/admin/review-crawl'
export type AppRoute = PublicRoute | MerchantRoute | AdminRoute

const LEGACY_ROUTE_REDIRECTS: Record<string, AppRoute> = {
  '/app/admin': '/admin',
}

const VALID_ROUTES: Set<AppRoute> = new Set<AppRoute>([
  '/',
  '/login',
  '/signup',
  '/app',
  '/app/reviews',
  '/app/settings',
  '/admin',
  '/admin/intake',
  '/admin/review-ops',
  '/admin/review-crawl',
])

export function getRouteFromHash(hash: string): AppRoute {
  if (!hash.startsWith('#/')) {
    return '/'
  }

  const candidate = hash.slice(1)
  const normalized = LEGACY_ROUTE_REDIRECTS[candidate] ?? candidate

  return VALID_ROUTES.has(normalized as AppRoute) ? (normalized as AppRoute) : '/'
}

export function isMerchantRoute(route: AppRoute): route is MerchantRoute {
  return route === '/app' || route === '/app/reviews' || route === '/app/settings'
}

export function isAdminRoute(route: AppRoute): route is AdminRoute {
  return (
    route === '/admin' ||
    route === '/admin/intake' ||
    route === '/admin/review-ops' ||
    route === '/admin/review-crawl'
  )
}

export function isProtectedRoute(route: AppRoute) {
  return isMerchantRoute(route) || isAdminRoute(route)
}
