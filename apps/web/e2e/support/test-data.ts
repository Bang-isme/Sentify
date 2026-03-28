function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, '')
}

const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || 'http://127.0.0.1:4173'
const apiBaseUrl =
  normalizeUrl(process.env.PLAYWRIGHT_API_BASE_URL) ||
  normalizeUrl(process.env.VITE_API_BASE_URL) ||
  'http://127.0.0.1:3100/api'

export const LOCAL_URLS = {
  webBaseUrl,
  apiBaseUrl,
} as const

export const HASH_ROUTES = {
  login: '/login',
  appHome: '/app',
  appReviews: '/app/reviews',
  appActions: '/app/actions',
  appSettings: '/app/settings',
  adminOverview: '/admin',
  adminRestaurants: '/admin/operations/restaurants',
  adminIntake: '/admin/operations/intake',
  adminReviewOps: '/admin/operations/review-ops',
  adminReviewCrawl: '/admin/operations/crawl',
  adminUsers: '/admin/access/users',
  adminMemberships: '/admin/access/memberships',
  adminHealthJobs: '/admin/platform/health-jobs',
  adminIntegrationsPolicies: '/admin/platform/integrations-policies',
  adminAudit: '/admin/platform/audit',
} as const

export const SEED_CREDENTIALS = {
  password: 'DemoPass123!',
  userPrimary: {
    email: 'demo.user.primary@sentify.local',
    fullName: 'Sentify Demo User Primary',
    role: 'USER' as const,
  },
  userSecondary: {
    email: 'demo.user.secondary@sentify.local',
    fullName: 'Sentify Demo User Secondary',
    role: 'USER' as const,
  },
  userTacombi: {
    email: 'demo.user.tacombi@sentify.local',
    fullName: 'Sentify Demo User Tacombi',
    role: 'USER' as const,
  },
  admin: {
    email: 'demo.admin@sentify.local',
    fullName: 'Sentify Demo Admin',
    role: 'ADMIN' as const,
  },
} as const

export const SEED_RESTAURANTS = {
  phoHong: 'Demo Quan Pho Hong',
  tacombi: 'Demo Tacombi',
} as const

export type SeedAccount = (typeof SEED_CREDENTIALS)[keyof typeof SEED_CREDENTIALS]
export type SeedRole = 'USER' | 'ADMIN'
