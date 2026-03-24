const DEFAULT_LOCAL_DEV_API_BASE_URL = 'http://localhost:3000/api'

const ENV_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '')

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
  datasetStatus: {
    sourcePolicy: 'ADMIN_CURATED' | 'UNCONFIGURED'
    lastPublishedAt: string | null
    lastPublishedSourceType: ReviewIntakeBatchSourceType | null
    pendingBatchCount: number
    readyBatchCount: number
    pendingItemCount: number
    approvedItemCount: number
    rejectedItemCount: number
  }
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

export type ReviewIntakeBatchSourceType = 'MANUAL' | 'BULK_PASTE' | 'CSV'
export type ReviewIntakeBatchStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'ARCHIVED'
export type ReviewIntakeItemApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ReviewIntakeBatchCounts {
  totalItems: number
  pendingItems: number
  approvedItems: number
  rejectedItems: number
  publishedItems: number
}

export interface ReviewIntakeItem {
  id: string
  batchId: string
  restaurantId: string
  rawAuthorName: string | null
  rawRating: number | null
  rawContent: string | null
  rawReviewDate: string | null
  normalizedAuthorName: string | null
  normalizedRating: number | null
  normalizedContent: string | null
  normalizedReviewDate: string | null
  approvalStatus: ReviewIntakeItemApprovalStatus
  reviewerNote: string | null
  canonicalReviewId: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewIntakeBatch {
  id: string
  restaurantId: string
  createdByUserId: string
  title: string | null
  sourceType: ReviewIntakeBatchSourceType
  status: ReviewIntakeBatchStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  counts: ReviewIntakeBatchCounts
  items?: ReviewIntakeItem[]
}

export interface CreateReviewIntakeBatchInput {
  restaurantId: string
  sourceType?: ReviewIntakeBatchSourceType
  title?: string
}

export interface CreateReviewIntakeItemInput {
  rawAuthorName?: string
  rawRating: number
  rawContent?: string | null
  rawReviewDate?: string | null
}

export interface UpdateReviewIntakeItemInput {
  normalizedAuthorName?: string | null
  normalizedRating?: number | null
  normalizedContent?: string | null
  normalizedReviewDate?: string | null
  approvalStatus?: ReviewIntakeItemApprovalStatus
  reviewerNote?: string | null
}

export interface PublishReviewIntakeBatchResult {
  batch: ReviewIntakeBatch
  publishedCount: number
  publishedReviewIds: string[]
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

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
  method?: 'GET' | 'POST' | 'PATCH'
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
  const headers = new Headers({
    Accept: 'application/json',
  })

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(buildUrl(path), {
    method: options.method ?? 'GET',
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
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
  })
}

export function login(input: LoginInput) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
  })
}

export function getSession() {
  return request<SessionResponse>('/auth/session')
}

export function logout() {
  return request<{ message: string }>('/auth/logout', {
    method: 'POST',
  })
}

export function listRestaurants() {
  return request<RestaurantMembership[]>('/restaurants')
}

export function createRestaurant(input: CreateRestaurantInput) {
  return request<RestaurantMembership>('/restaurants', {
    method: 'POST',
    body: input,
  })
}

export function getRestaurantDetail(restaurantId: string) {
  return request<RestaurantDetail>(`/restaurants/${restaurantId}`)
}

export function updateRestaurant(restaurantId: string, input: UpdateRestaurantInput) {
  return request<RestaurantDetail>(`/restaurants/${restaurantId}`, {
    method: 'PATCH',
    body: input,
  })
}

export function getDashboardKpi(restaurantId: string) {
  return request<InsightSummary>(`/restaurants/${restaurantId}/dashboard/kpi`)
}

export function getSentimentBreakdown(restaurantId: string) {
  return request<SentimentBreakdownRow[]>(`/restaurants/${restaurantId}/dashboard/sentiment`)
}

export function getTrend(restaurantId: string, period: TrendPeriod) {
  return request<TrendPoint[]>(`/restaurants/${restaurantId}/dashboard/trend?period=${period}`)
}

export function getComplaintKeywords(restaurantId: string) {
  return request<ComplaintKeyword[]>(`/restaurants/${restaurantId}/dashboard/complaints`)
}

export function listReviewEvidence(restaurantId: string, query: ReviewsQuery) {
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

export function createReviewIntakeBatch(input: CreateReviewIntakeBatchInput) {
  return request<ReviewIntakeBatch>('/admin/review-batches', {
    method: 'POST',
    body: input,
  })
}

export function listReviewIntakeBatches(restaurantId: string) {
  return request<ReviewIntakeBatch[]>(`/admin/review-batches?restaurantId=${encodeURIComponent(restaurantId)}`)
}

export function getReviewIntakeBatch(batchId: string) {
  return request<ReviewIntakeBatch>(`/admin/review-batches/${batchId}`)
}

export function addReviewIntakeItems(batchId: string, items: CreateReviewIntakeItemInput[]) {
  return request<ReviewIntakeBatch>(`/admin/review-batches/${batchId}/items`, {
    method: 'POST',
    body: { items },
  })
}

export function updateReviewIntakeItem(itemId: string, input: UpdateReviewIntakeItemInput) {
  return request<ReviewIntakeBatch>(`/admin/review-items/${itemId}`, {
    method: 'PATCH',
    body: input,
  })
}

export function publishReviewIntakeBatch(batchId: string) {
  return request<PublishReviewIntakeBatchResult>(`/admin/review-batches/${batchId}/publish`, {
    method: 'POST',
  })
}
