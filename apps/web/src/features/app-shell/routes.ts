export type PublicRoute = '/' | '/login' | '/signup'
export type MerchantRoute = '/app' | '/app/reviews' | '/app/actions' | '/app/settings'
export type AdminRoute =
  | '/admin'
  | '/admin/operations/restaurants'
  | '/admin/operations/intake'
  | '/admin/operations/review-ops'
  | '/admin/operations/crawl'
  | '/admin/access/users'
  | '/admin/access/memberships'
  | '/admin/platform/health-jobs'
  | '/admin/platform/integrations-policies'
  | '/admin/platform/audit'
export type AppRoute = PublicRoute | MerchantRoute | AdminRoute

const LEGACY_ROUTE_REDIRECTS: Record<string, AppRoute> = {
  '/app/admin': '/admin',
  '/admin/intake': '/admin/operations/intake',
  '/admin/review-ops': '/admin/operations/review-ops',
  '/admin/review-crawl': '/admin/operations/crawl',
}

const VALID_ROUTES: Set<AppRoute> = new Set<AppRoute>([
  '/',
  '/login',
  '/signup',
  '/app',
  '/app/reviews',
  '/app/actions',
  '/app/settings',
  '/admin',
  '/admin/operations/restaurants',
  '/admin/operations/intake',
  '/admin/operations/review-ops',
  '/admin/operations/crawl',
  '/admin/access/users',
  '/admin/access/memberships',
  '/admin/platform/health-jobs',
  '/admin/platform/integrations-policies',
  '/admin/platform/audit',
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
  return route === '/app' || route === '/app/reviews' || route === '/app/actions' || route === '/app/settings'
}

export function isAdminRoute(route: AppRoute): route is AdminRoute {
  return route === '/admin' || route.startsWith('/admin/')
}

export function isProtectedRoute(route: AppRoute) {
  return isMerchantRoute(route) || isAdminRoute(route)
}

export function isAdminOperationsRoute(route: AppRoute) {
  return route.startsWith('/admin/operations/')
}

export function isAdminAccessRoute(route: AppRoute) {
  return route.startsWith('/admin/access/')
}

export function isAdminPlatformRoute(route: AppRoute) {
  return route.startsWith('/admin/platform/')
}
