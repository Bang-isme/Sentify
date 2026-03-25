export const LOCAL_URLS = {
  webBaseUrl: 'http://localhost:5173',
  apiBaseUrl: 'http://localhost:3000/api',
} as const

export const HASH_ROUTES = {
  login: '/login',
  appHome: '/app',
  appReviews: '/app/reviews',
  appSettings: '/app/settings',
  adminOverview: '/admin',
  adminIntake: '/admin/intake',
  adminReviewOps: '/admin/review-ops',
  adminReviewCrawl: '/admin/review-crawl',
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
