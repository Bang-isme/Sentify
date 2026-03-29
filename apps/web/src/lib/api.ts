const DEFAULT_LOCAL_DEV_API_BASE_URL = 'http://localhost:3000/api'
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

const ENV_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '')
const USE_MOCK_API = ((import.meta.env.VITE_USE_MOCK_API as string | undefined) ?? '').trim() === 'true'

const API_BASE_URL = ENV_API_BASE_URL
  ? ENV_API_BASE_URL
  : import.meta.env.DEV
    ? DEFAULT_LOCAL_DEV_API_BASE_URL
    : '/api'

export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type TrendPeriod = 'week' | 'month'

export interface RestaurantMembership {
  id: string
  name: string
  slug: string
  permission: string
  googleMapUrl?: string | null
  totalReviews?: number
}

export interface InsightSummary {
  totalReviews: number
  averageRating: number
  positivePercentage: number
  neutralPercentage: number
  negativePercentage: number
}

export interface RestaurantDetail {
  id: string
  name: string
  slug: string
  address: string | null
  googleMapUrl: string | null
  permission: string
  insightSummary: InsightSummary
}

export interface AuthUser {
  id: string
  email: string
  fullName: string
  restaurants?: RestaurantMembership[]
}

export interface AuthResponse {
  expiresIn: number
  user: AuthUser
}

export interface SessionResponse {
  user: AuthUser
}

export interface RegisterInput {
  fullName: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface ForgotPasswordInput {
  email: string
}

export interface CreateRestaurantInput {
  name: string
  address?: string
  googleMapUrl?: string
}

export interface UpdateRestaurantInput {
  name?: string
  address?: string | null
  googleMapUrl?: string | null
}

export interface SentimentBreakdownRow {
  label: SentimentLabel
  count: number
  percentage: number
}

export interface TrendPoint {
  label: string
  averageRating: number
  reviewCount: number
}

export interface ComplaintKeyword {
  keyword: string
  count: number
  percentage: number
}

export interface ReviewItem {
  id: string
  externalId: string
  authorName: string | null
  rating: number
  content: string | null
  sentiment: SentimentLabel | null
  reviewDate: string | null
}

export interface ReviewListResponse {
  data: ReviewItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ImportResult {
  imported: number
  skipped: number
  total: number
  message: string
}

export type ImportRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface ImportRunSummary {
  id: string
  restaurantId: string
  status: ImportRunStatus
  phase: string | null
  progressPercent: number
  imported: number
  skipped: number
  total: number
  scrape: {
    source: string | null
    advertisedTotalReviews: number | null
    collectedReviewCount: number | null
    targetReviewCount: number | null
    explicitTarget: number | null
    hardMaxReviews: number | null
    reachedRequestedTarget: boolean | null
    reachedEndOfFeed: boolean | null
    coveragePercentage: number | null
    isCompleteSync: boolean | null
  }
  message: string | null
  errorCode: string | null
  errorMessage: string | null
  errorDetails: unknown
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface QueueImportResult {
  queued: boolean
  alreadyActive: boolean
  run: ImportRunSummary | null
  message: string
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export class ApiClientError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = payload.code
    this.details = payload.details
  }
}

interface ApiRequestOptions {
  body?: unknown
  method?: ApiMethod
  token?: string
  unwrapData?: boolean
}

export interface ReviewsQuery {
  rating?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

let csrfTokenRequest: Promise<string | null> | null = null
const MOCK_DB_STORAGE_KEY = 'sentify-mock-db-v1'
const MOCK_SESSION_EXPIRES_IN_SECONDS = 60 * 60

const EMPTY_INSIGHT_SUMMARY: InsightSummary = {
  totalReviews: 0,
  averageRating: 0,
  positivePercentage: 0,
  neutralPercentage: 0,
  negativePercentage: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null
  }

  const prefix = `${name}=`
  const match = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix))

  return match ? decodeURIComponent(match.slice(prefix.length)) : null
}

function isMutatingMethod(method: ApiMethod) {
  return method === 'POST' || method === 'PATCH' || method === 'DELETE'
}

async function ensureCsrfToken() {
  const existingToken = readCookie(CSRF_COOKIE_NAME)

  if (existingToken) {
    return existingToken
  }

  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(buildUrl('/auth/csrf'), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
      .catch(() => null)
      .then(() => readCookie(CSRF_COOKIE_NAME))
      .finally(() => {
        csrfTokenRequest = null
      })
  }

  return csrfTokenRequest
}

function normalizeRestaurantMembership(value: unknown): RestaurantMembership {
  const record = isRecord(value) ? value : {}

  return {
    id: typeof record.id === 'string' ? record.id : '',
    name: typeof record.name === 'string' ? record.name : '',
    slug: typeof record.slug === 'string' ? record.slug : '',
    permission: typeof record.permission === 'string' ? record.permission : 'USER',
    googleMapUrl: typeof record.googleMapUrl === 'string' ? record.googleMapUrl : null,
    totalReviews: typeof record.totalReviews === 'number' ? record.totalReviews : 0,
  }
}

function normalizeInsightSummary(value: unknown): InsightSummary {
  const record = isRecord(value) ? value : {}

  return {
    totalReviews: typeof record.totalReviews === 'number' ? record.totalReviews : 0,
    averageRating: typeof record.averageRating === 'number' ? record.averageRating : 0,
    positivePercentage:
      typeof record.positivePercentage === 'number' ? record.positivePercentage : 0,
    neutralPercentage:
      typeof record.neutralPercentage === 'number' ? record.neutralPercentage : 0,
    negativePercentage:
      typeof record.negativePercentage === 'number' ? record.negativePercentage : 0,
  }
}

function normalizeRestaurantDetail(value: unknown): RestaurantDetail {
  const record = isRecord(value) ? value : {}

  return {
    id: typeof record.id === 'string' ? record.id : '',
    name: typeof record.name === 'string' ? record.name : '',
    slug: typeof record.slug === 'string' ? record.slug : '',
    address: typeof record.address === 'string' ? record.address : null,
    googleMapUrl: typeof record.googleMapUrl === 'string' ? record.googleMapUrl : null,
    permission: typeof record.permission === 'string' ? record.permission : 'USER',
    insightSummary: normalizeInsightSummary(record.insightSummary ?? EMPTY_INSIGHT_SUMMARY),
  }
}

function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    restaurants: Array.isArray(user.restaurants)
      ? user.restaurants.map((restaurant) => normalizeRestaurantMembership(restaurant))
      : [],
  }
}

interface MockAccount {
  id: string
  email: string
  fullName: string
  password: string
}

interface MockReview extends ReviewItem {
  keywords: string[]
}

interface MockRestaurantRecord {
  id: string
  name: string
  slug: string
  address: string | null
  googleMapUrl: string | null
  memberUserIds: string[]
  reviews: MockReview[]
  importRuns: ImportRunSummary[]
}

interface MockDb {
  accounts: MockAccount[]
  restaurants: MockRestaurantRecord[]
  currentUserId: string | null
  counters: {
    user: number
    restaurant: number
    review: number
    run: number
  }
}

function createMockApiError(status: number, code: string, message: string, details?: unknown) {
  return new ApiClientError(status, {
    code,
    message,
    details,
  })
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toIsoDate(daysAgo: number) {
  const value = new Date()
  value.setDate(value.getDate() - daysAgo)
  return value.toISOString()
}

function createSeedReviews(): MockReview[] {
  return [
    {
      id: 'review-seed-1',
      externalId: 'seed-1',
      authorName: 'Linh',
      rating: 5,
      content: 'Service was fast and the staff were very friendly.',
      sentiment: 'POSITIVE',
      reviewDate: toIsoDate(2),
      keywords: ['service', 'staff'],
    },
    {
      id: 'review-seed-2',
      externalId: 'seed-2',
      authorName: 'Minh',
      rating: 4,
      content: 'Food came out quickly and tasted fresh.',
      sentiment: 'POSITIVE',
      reviewDate: toIsoDate(4),
      keywords: ['food', 'speed'],
    },
    {
      id: 'review-seed-3',
      externalId: 'seed-3',
      authorName: 'An',
      rating: 2,
      content: 'Wait time was long and the drink arrived late.',
      sentiment: 'NEGATIVE',
      reviewDate: toIsoDate(6),
      keywords: ['wait time', 'drink'],
    },
    {
      id: 'review-seed-4',
      externalId: 'seed-4',
      authorName: 'Bao',
      rating: 3,
      content: 'The place is clean but the music was too loud.',
      sentiment: 'NEUTRAL',
      reviewDate: toIsoDate(9),
      keywords: ['music', 'cleanliness'],
    },
    {
      id: 'review-seed-5',
      externalId: 'seed-5',
      authorName: 'Trang',
      rating: 1,
      content: 'Cold food and slow service during lunch rush.',
      sentiment: 'NEGATIVE',
      reviewDate: toIsoDate(12),
      keywords: ['food', 'service', 'wait time'],
    },
    {
      id: 'review-seed-6',
      externalId: 'seed-6',
      authorName: 'Khoa',
      rating: 5,
      content: 'Great atmosphere, fast service, would come back.',
      sentiment: 'POSITIVE',
      reviewDate: toIsoDate(16),
      keywords: ['atmosphere', 'service'],
    },
    {
      id: 'review-seed-7',
      externalId: 'seed-7',
      authorName: 'Nhi',
      rating: 4,
      content: 'Tasty noodles and clean tables.',
      sentiment: 'POSITIVE',
      reviewDate: toIsoDate(20),
      keywords: ['food', 'cleanliness'],
    },
    {
      id: 'review-seed-8',
      externalId: 'seed-8',
      authorName: 'Dat',
      rating: 2,
      content: 'The soup was cold and the queue moved slowly.',
      sentiment: 'NEGATIVE',
      reviewDate: toIsoDate(24),
      keywords: ['food', 'wait time'],
    },
  ]
}

function createSeedImportRuns(restaurantId: string): ImportRunSummary[] {
  return [
    {
      id: 'run-seed-1',
      restaurantId,
      status: 'COMPLETED',
      phase: 'COMPLETED',
      progressPercent: 100,
      imported: 8,
      skipped: 0,
      total: 8,
      scrape: {
        source: 'mock-google-maps',
        advertisedTotalReviews: 8,
        collectedReviewCount: 8,
        targetReviewCount: 8,
        explicitTarget: 8,
        hardMaxReviews: 8,
        reachedRequestedTarget: true,
        reachedEndOfFeed: true,
        coveragePercentage: 100,
        isCompleteSync: true,
      },
      message: 'Mock seed import completed.',
      errorCode: null,
      errorMessage: null,
      errorDetails: null,
      startedAt: toIsoDate(7),
      completedAt: toIsoDate(7),
      failedAt: null,
      createdAt: toIsoDate(7),
      updatedAt: toIsoDate(7),
    },
  ]
}

function buildInitialMockDb(): MockDb {
  const demoUserId = 'user-seed-1'
  const restaurantId = 'restaurant-seed-1'

  return {
    accounts: [
      {
        id: demoUserId,
        email: 'demo.user.primary@sentify.local',
        fullName: 'Demo Merchant',
        password: 'DemoPass123!',
      },
    ],
    restaurants: [
      {
        id: restaurantId,
        name: 'Bep Co Mai',
        slug: 'bep-co-mai',
        address: '59 Hai Phong, Da Nang',
        googleMapUrl: 'https://maps.google.com/?cid=sentify-demo-bep-co-mai',
        memberUserIds: [demoUserId],
        reviews: createSeedReviews(),
        importRuns: createSeedImportRuns(restaurantId),
      },
      {
        id: 'restaurant-seed-2',
        name: 'Pho Phoi',
        slug: 'pho-phoi',
        address: '88 Tran Phu, Da Nang',
        googleMapUrl: 'https://maps.google.com/?cid=sentify-demo-pho-phoi',
        memberUserIds: [demoUserId],
        reviews: [],
        importRuns: [],
      },
    ],
    currentUserId: null,
    counters: {
      user: 2,
      restaurant: 3,
      review: 100,
      run: 2,
    },
  }
}

function readMockDb(): MockDb {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return buildInitialMockDb()
  }

  const raw = localStorage.getItem(MOCK_DB_STORAGE_KEY)

  if (!raw) {
    const initial = buildInitialMockDb()
    localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(initial))
    return initial
  }

  try {
    const parsed = JSON.parse(raw) as MockDb
    if (
      !parsed ||
      !Array.isArray(parsed.accounts) ||
      !Array.isArray(parsed.restaurants) ||
      !parsed.counters
    ) {
      throw new Error('Invalid mock db')
    }

    return parsed
  } catch {
    const initial = buildInitialMockDb()
    localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
}

function writeMockDb(db: MockDb) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(db))
}

function nextMockId(db: MockDb, counterKey: keyof MockDb['counters'], prefix: string) {
  const nextValue = db.counters[counterKey]
  db.counters[counterKey] += 1
  return `${prefix}-${nextValue}`
}

function requireMockCurrentUser(db: MockDb) {
  const user = db.accounts.find((account) => account.id === db.currentUserId)

  if (!user) {
    throw createMockApiError(401, 'AUTH_INVALID_TOKEN', 'Access token is invalid or expired')
  }

  return user
}

function getMockRestaurantForUser(db: MockDb, userId: string, restaurantId: string) {
  const restaurant = db.restaurants.find(
    (candidate) =>
      candidate.id === restaurantId && candidate.memberUserIds.includes(userId),
  )

  if (!restaurant) {
    throw createMockApiError(404, 'NOT_FOUND', 'Restaurant not found')
  }

  return restaurant
}

function buildMockRestaurantMembership(restaurant: MockRestaurantRecord): RestaurantMembership {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    permission: 'OWNER',
    googleMapUrl: restaurant.googleMapUrl,
    totalReviews: restaurant.reviews.length,
  }
}

function buildMockInsightSummary(reviews: MockReview[]): InsightSummary {
  if (reviews.length === 0) {
    return { ...EMPTY_INSIGHT_SUMMARY }
  }

  const totalReviews = reviews.length
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
  const counts = {
    POSITIVE: reviews.filter((review) => review.sentiment === 'POSITIVE').length,
    NEUTRAL: reviews.filter((review) => review.sentiment === 'NEUTRAL').length,
    NEGATIVE: reviews.filter((review) => review.sentiment === 'NEGATIVE').length,
  }

  return {
    totalReviews,
    averageRating: Number((totalRating / totalReviews).toFixed(1)),
    positivePercentage: Number(((counts.POSITIVE / totalReviews) * 100).toFixed(1)),
    neutralPercentage: Number(((counts.NEUTRAL / totalReviews) * 100).toFixed(1)),
    negativePercentage: Number(((counts.NEGATIVE / totalReviews) * 100).toFixed(1)),
  }
}

function buildMockRestaurantDetail(restaurant: MockRestaurantRecord): RestaurantDetail {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    address: restaurant.address,
    googleMapUrl: restaurant.googleMapUrl,
    permission: 'OWNER',
    insightSummary: buildMockInsightSummary(restaurant.reviews),
  }
}

function buildMockSentimentBreakdown(reviews: MockReview[]): SentimentBreakdownRow[] {
  const summary = buildMockInsightSummary(reviews)
  const counts = {
    POSITIVE: reviews.filter((review) => review.sentiment === 'POSITIVE').length,
    NEUTRAL: reviews.filter((review) => review.sentiment === 'NEUTRAL').length,
    NEGATIVE: reviews.filter((review) => review.sentiment === 'NEGATIVE').length,
  }

  return [
    { label: 'POSITIVE', count: counts.POSITIVE, percentage: summary.positivePercentage },
    { label: 'NEUTRAL', count: counts.NEUTRAL, percentage: summary.neutralPercentage },
    { label: 'NEGATIVE', count: counts.NEGATIVE, percentage: summary.negativePercentage },
  ]
}

function buildMockTrend(reviews: MockReview[], period: TrendPeriod): TrendPoint[] {
  if (reviews.length === 0) {
    return []
  }

  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: period === 'week' ? 'numeric' : undefined,
    year: period === 'month' ? 'numeric' : undefined,
  })
  const buckets = new Map<string, { totalRating: number; reviewCount: number; sortValue: number }>()

  for (const review of reviews) {
    const date = new Date(review.reviewDate ?? new Date().toISOString())
    const bucketDate =
      period === 'month'
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const key = bucketDate.toISOString()
    const current = buckets.get(key) ?? { totalRating: 0, reviewCount: 0, sortValue: bucketDate.getTime() }
    current.totalRating += review.rating
    current.reviewCount += 1
    buckets.set(key, current)
  }

  return [...buckets.entries()]
    .sort((left, right) => left[1].sortValue - right[1].sortValue)
    .map(([key, value]) => ({
      label: formatter.format(new Date(key)),
      averageRating: Number((value.totalRating / value.reviewCount).toFixed(1)),
      reviewCount: value.reviewCount,
    }))
}

function buildMockComplaintKeywords(reviews: MockReview[]): ComplaintKeyword[] {
  const keywordCounts = new Map<string, number>()
  const negativeReviews = reviews.filter((review) => review.sentiment === 'NEGATIVE')

  for (const review of negativeReviews) {
    for (const keyword of review.keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1)
    }
  }

  const totalNegativeReviews = negativeReviews.length || 1

  return [...keywordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([keyword, count]) => ({
      keyword,
      count,
      percentage: Number(((count / totalNegativeReviews) * 100).toFixed(1)),
    }))
}

function buildMockReviewEvidence(reviews: MockReview[], query: ReviewsQuery): ReviewListResponse {
  const rating = query.rating ? Number(query.rating) : undefined
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null
  const page = query.page ?? 1
  const limit = query.limit ?? 10

  let filtered = [...reviews]

  if (rating && Number.isFinite(rating)) {
    filtered = filtered.filter((review) => review.rating === rating)
  }

  if (from) {
    filtered = filtered.filter((review) => review.reviewDate && new Date(review.reviewDate) >= from)
  }

  if (to) {
    filtered = filtered.filter((review) => review.reviewDate && new Date(review.reviewDate) <= to)
  }

  filtered.sort((left, right) => {
    const leftDate = new Date(left.reviewDate ?? 0).getTime()
    const rightDate = new Date(right.reviewDate ?? 0).getTime()
    return rightDate - leftDate
  })

  const total = filtered.length
  const start = (page - 1) * limit
  const data = filtered.slice(start, start + limit).map((review) => {
    const { keywords, ...reviewWithoutKeywords } = review
    void keywords
    return reviewWithoutKeywords
  })

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  }
}

function buildMockUser(db: MockDb, account: MockAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    restaurants: db.restaurants
      .filter((restaurant) => restaurant.memberUserIds.includes(account.id))
      .map((restaurant) => buildMockRestaurantMembership(restaurant)),
  }
}

function createMockImportedReviews(db: MockDb, restaurant: MockRestaurantRecord) {
  const createdAt = new Date().toISOString()
  const items: MockReview[] = [
    {
      id: nextMockId(db, 'review', 'review'),
      externalId: nextMockId(db, 'review', 'external'),
      authorName: 'New Guest',
      rating: 4,
      content: 'The lunch service improved a lot this week.',
      sentiment: 'POSITIVE',
      reviewDate: createdAt,
      keywords: ['service'],
    },
    {
      id: nextMockId(db, 'review', 'review'),
      externalId: nextMockId(db, 'review', 'external'),
      authorName: 'Queue Watch',
      rating: 2,
      content: 'Still waiting too long during peak hour.',
      sentiment: 'NEGATIVE',
      reviewDate: createdAt,
      keywords: ['wait time'],
    },
  ]

  restaurant.reviews.unshift(...items)

  const runId = nextMockId(db, 'run', 'run')
  const run: ImportRunSummary = {
    id: runId,
    restaurantId: restaurant.id,
    status: 'COMPLETED',
    phase: 'COMPLETED',
    progressPercent: 100,
    imported: items.length,
    skipped: 0,
    total: items.length,
    scrape: {
      source: 'mock-google-maps',
      advertisedTotalReviews: restaurant.reviews.length,
      collectedReviewCount: items.length,
      targetReviewCount: items.length,
      explicitTarget: items.length,
      hardMaxReviews: items.length,
      reachedRequestedTarget: true,
      reachedEndOfFeed: true,
      coveragePercentage: 100,
      isCompleteSync: true,
    },
    message: `Mock import completed with ${items.length} new reviews.`,
    errorCode: null,
    errorMessage: null,
    errorDetails: null,
    startedAt: createdAt,
    completedAt: createdAt,
    failedAt: null,
    createdAt,
    updatedAt: createdAt,
  }

  restaurant.importRuns.unshift(run)
  return run
}

async function mockRegister(input: RegisterInput): Promise<AuthResponse> {
  const db = readMockDb()
  const email = input.email.trim().toLowerCase()

  if (db.accounts.some((account) => account.email === email)) {
    throw createMockApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists')
  }

  const account: MockAccount = {
    id: nextMockId(db, 'user', 'user'),
    email,
    fullName: input.fullName.trim(),
    password: input.password,
  }

  db.accounts.push(account)
  db.currentUserId = account.id
  writeMockDb(db)

  return {
    expiresIn: MOCK_SESSION_EXPIRES_IN_SECONDS,
    user: buildMockUser(db, account),
  }
}

async function mockLogin(input: LoginInput): Promise<AuthResponse> {
  const db = readMockDb()
  const email = input.email.trim().toLowerCase()
  const account = db.accounts.find((candidate) => candidate.email === email)

  if (!account || account.password !== input.password) {
    throw createMockApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
  }

  db.currentUserId = account.id
  writeMockDb(db)

  return {
    expiresIn: MOCK_SESSION_EXPIRES_IN_SECONDS,
    user: buildMockUser(db, account),
  }
}

async function mockGetSession(): Promise<SessionResponse> {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  return { user: buildMockUser(db, account) }
}

async function mockLogout() {
  const db = readMockDb()
  db.currentUserId = null
  writeMockDb(db)
  return { message: 'Logged out successfully' }
}

async function mockForgotPassword(input: ForgotPasswordInput) {
  void input
  return {
    message: 'If the email is registered, a reset link has been sent.',
  }
}

async function mockListRestaurants() {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  return db.restaurants
    .filter((restaurant) => restaurant.memberUserIds.includes(account.id))
    .map((restaurant) => buildMockRestaurantMembership(restaurant))
}

async function mockCreateRestaurant(input: CreateRestaurantInput) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const id = nextMockId(db, 'restaurant', 'restaurant')
  const slugBase = slugify(input.name) || id
  const restaurant: MockRestaurantRecord = {
    id,
    name: input.name.trim(),
    slug: db.restaurants.some((candidate) => candidate.slug === slugBase) ? `${slugBase}-${id}` : slugBase,
    address: input.address?.trim() || null,
    googleMapUrl: input.googleMapUrl?.trim() || null,
    memberUserIds: [account.id],
    reviews: [],
    importRuns: [],
  }

  db.restaurants.unshift(restaurant)
  writeMockDb(db)
  return buildMockRestaurantMembership(restaurant)
}

async function mockGetRestaurantDetail(restaurantId: string) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  return buildMockRestaurantDetail(getMockRestaurantForUser(db, account.id, restaurantId))
}

async function mockUpdateRestaurant(restaurantId: string, input: UpdateRestaurantInput) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)

  if (typeof input.name === 'string' && input.name.trim()) {
    restaurant.name = input.name.trim()
  }

  if (Object.prototype.hasOwnProperty.call(input, 'address')) {
    restaurant.address = input.address?.trim() || null
  }

  if (Object.prototype.hasOwnProperty.call(input, 'googleMapUrl')) {
    restaurant.googleMapUrl = input.googleMapUrl?.trim() || null
  }

  writeMockDb(db)
  return buildMockRestaurantDetail(restaurant)
}

async function mockImportReviews(restaurantId: string): Promise<QueueImportResult> {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)

  if (!restaurant.googleMapUrl) {
    throw createMockApiError(
      400,
      'MISSING_GOOGLE_MAP_URL',
      'Restaurant must have a Google Maps URL before importing reviews',
    )
  }

  const run = createMockImportedReviews(db, restaurant)
  writeMockDb(db)

  return {
    queued: true,
    alreadyActive: false,
    run,
    message: run.message ?? 'Mock import completed.',
  }
}

async function mockGetLatestImportRun(restaurantId: string): Promise<ImportRunSummary | null> {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return restaurant.importRuns[0] ?? null
}

async function mockListImportRuns(restaurantId: string, limit = 6): Promise<ImportRunSummary[]> {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return restaurant.importRuns.slice(0, limit)
}

async function mockGetDashboardKpi(restaurantId: string) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return buildMockInsightSummary(restaurant.reviews)
}

async function mockGetSentimentBreakdown(restaurantId: string) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return buildMockSentimentBreakdown(restaurant.reviews)
}

async function mockGetTrend(restaurantId: string, period: TrendPeriod) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return buildMockTrend(restaurant.reviews, period)
}

async function mockGetComplaintKeywords(restaurantId: string) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return buildMockComplaintKeywords(restaurant.reviews)
}

async function mockListReviewEvidence(restaurantId: string, query: ReviewsQuery) {
  const db = readMockDb()
  const account = requireMockCurrentUser(db)
  const restaurant = getMockRestaurantForUser(db, account.id, restaurantId)
  return buildMockReviewEvidence(restaurant.reviews, query)
}

function resolveApiBaseUrl() {
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return API_BASE_URL
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return new URL(API_BASE_URL, origin).toString().replace(/\/$/, '')
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${resolveApiBaseUrl()}${path}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers({
    Accept: 'application/json',
  })

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  if (isMutatingMethod(method) && !options.token) {
    const csrfToken = await ensureCsrfToken()

    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }
  }

  const response = await fetch(buildUrl(path), {
    method,
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: ApiErrorPayload }
    | T
    | null

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' && 'error' in payload && payload.error
        ? payload.error
        : {
            code: 'REQUEST_FAILED',
            message: 'Request failed',
          }

    throw new ApiClientError(response.status, errorPayload)
  }

  if (options.unwrapData === false) {
    return payload as T
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}

export function register(input: RegisterInput) {
  if (USE_MOCK_API) {
    return mockRegister(input)
  }

  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
  }).then((result) => ({
    ...result,
    user: normalizeAuthUser(result.user),
  }))
}

export function login(input: LoginInput) {
  if (USE_MOCK_API) {
    return mockLogin(input)
  }

  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
  }).then((result) => ({
    ...result,
    user: normalizeAuthUser(result.user),
  }))
}

export function getSession() {
  if (USE_MOCK_API) {
    return mockGetSession()
  }

  return request<SessionResponse>('/auth/session').then((result) => ({
    ...result,
    user: normalizeAuthUser(result.user),
  }))
}

export function logout() {
  if (USE_MOCK_API) {
    return mockLogout()
  }

  return request<{ message: string }>('/auth/logout', {
    method: 'POST',
  })
}

export function forgotPassword(input: ForgotPasswordInput) {
  if (USE_MOCK_API) {
    return mockForgotPassword(input)
  }

  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: input,
  })
}

export function listRestaurants() {
  if (USE_MOCK_API) {
    return mockListRestaurants()
  }

  return request<RestaurantMembership[]>('/restaurants').then((result) =>
    result.map((restaurant) => normalizeRestaurantMembership(restaurant)),
  )
}

export function createRestaurant(input: CreateRestaurantInput) {
  if (USE_MOCK_API) {
    return mockCreateRestaurant(input)
  }

  return request<RestaurantMembership>('/restaurants', {
    method: 'POST',
    body: input,
  }).then((result) => normalizeRestaurantMembership(result))
}

export function getRestaurantDetail(restaurantId: string) {
  if (USE_MOCK_API) {
    return mockGetRestaurantDetail(restaurantId)
  }

  return request<RestaurantDetail>(`/restaurants/${restaurantId}`).then((result) =>
    normalizeRestaurantDetail(result),
  )
}

export function updateRestaurant(restaurantId: string, input: UpdateRestaurantInput) {
  if (USE_MOCK_API) {
    return mockUpdateRestaurant(restaurantId, input)
  }

  return request<RestaurantDetail>(`/restaurants/${restaurantId}`, {
    method: 'PATCH',
    body: input,
  }).then((result) => normalizeRestaurantDetail(result))
}

export function importReviews(restaurantId: string): Promise<QueueImportResult> {
  if (USE_MOCK_API) {
    return mockImportReviews(restaurantId)
  }

  void restaurantId

  return Promise.resolve({
    queued: false,
    alreadyActive: false,
    run: null,
    message:
      'This backend moved review ingestion to the admin workflow. Save a Google Maps URL in Settings and use the admin control plane to crawl/publish reviews.',
  } satisfies QueueImportResult)
}

export function getLatestImportRun(restaurantId: string): Promise<ImportRunSummary | null> {
  if (USE_MOCK_API) {
    return mockGetLatestImportRun(restaurantId)
  }

  void restaurantId
  return Promise.resolve(null)
}

export function listImportRuns(restaurantId: string, limit = 6): Promise<ImportRunSummary[]> {
  if (USE_MOCK_API) {
    return mockListImportRuns(restaurantId, limit)
  }

  void restaurantId
  void limit
  return Promise.resolve([])
}

export function getDashboardKpi(restaurantId: string) {
  if (USE_MOCK_API) {
    return mockGetDashboardKpi(restaurantId)
  }

  return request<InsightSummary>(`/restaurants/${restaurantId}/dashboard/kpi`)
}

export function getSentimentBreakdown(restaurantId: string) {
  if (USE_MOCK_API) {
    return mockGetSentimentBreakdown(restaurantId)
  }

  return request<SentimentBreakdownRow[]>(`/restaurants/${restaurantId}/dashboard/sentiment`)
}

export function getTrend(restaurantId: string, period: TrendPeriod) {
  if (USE_MOCK_API) {
    return mockGetTrend(restaurantId, period)
  }

  return request<TrendPoint[]>(`/restaurants/${restaurantId}/dashboard/trend?period=${period}`)
}

export function getComplaintKeywords(restaurantId: string) {
  if (USE_MOCK_API) {
    return mockGetComplaintKeywords(restaurantId)
  }

  return request<ComplaintKeyword[]>(`/restaurants/${restaurantId}/dashboard/complaints`)
}

export function listReviewEvidence(restaurantId: string, query: ReviewsQuery) {
  if (USE_MOCK_API) {
    return mockListReviewEvidence(restaurantId, query)
  }

  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const suffix = searchParams.size ? `?${searchParams.toString()}` : ''

  return request<ReviewListResponse>(`/restaurants/${restaurantId}/reviews${suffix}`, {
    unwrapData: false,
  })
}
