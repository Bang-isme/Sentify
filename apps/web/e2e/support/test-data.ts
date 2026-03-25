export const LOCAL_URLS = {
  webBaseUrl: 'http://localhost:5173',
  apiBaseUrl: 'http://localhost:3000/api',
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
