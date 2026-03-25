export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type TrendPeriod = 'week' | 'month'
export type UserRole = 'USER' | 'ADMIN' | (string & {})

export interface RestaurantMembership {
  id: string
  name: string
  slug: string
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

export type ReviewIntakeBatchSourceType = 'MANUAL' | 'BULK_PASTE' | 'CSV' | 'GOOGLE_MAPS_CRAWL'
export type ReviewIntakeBatchStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'ARCHIVED'
export type ReviewIntakeItemApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

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
  insightSummary: InsightSummary
}

export interface AdminRestaurantSummary {
  id: string
  name: string
  slug: string
  address: string | null
  googleMapUrl: string | null
  totalReviews: number
  memberCount: number
  pendingBatchCount: number
  activeSourceCount: number
  insightSummary: InsightSummary
  createdAt: string
  updatedAt: string
}

export interface AdminRestaurantDetail {
  restaurant: {
    id: string
    name: string
    slug: string
    address: string | null
    googleMapUrl: string | null
    totalReviews: number
    memberCount: number
    createdAt: string
    updatedAt: string
  }
  userFlow: {
    datasetStatus: RestaurantDetail['datasetStatus']
    insightSummary: InsightSummary
  }
  adminFlow: {
    sourceStats: {
      totalCount: number
      activeCount: number
      disabledCount: number
    }
    latestRun: AdminReviewCrawlRun | null
    openBatches: AdminReviewIntakeBatchSummary[]
    nextActions: string[]
  }
}

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
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

export interface AdminReviewIntakeBatchSummary {
  id: string
  title: string | null
  sourceType: ReviewIntakeBatchSourceType
  status: ReviewIntakeBatchStatus
  createdAt: string
  updatedAt: string
  counts: ReviewIntakeBatchCounts
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

export interface ReviewsQuery {
  rating?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type ReviewCrawlSourceStatus = 'ACTIVE' | 'DISABLED'
export type ReviewCrawlRunStrategy = 'INCREMENTAL' | 'BACKFILL'
export type ReviewCrawlRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
export type ReviewCrawlRunPriority = 'HIGH' | 'NORMAL' | 'LOW'

export interface ReviewCrawlSource {
  id: string
  restaurantId: string
  provider: string
  status: ReviewCrawlSourceStatus
  inputUrl: string
  resolvedUrl: string | null
  canonicalCid: string
  placeHexId: string | null
  googlePlaceId: string | null
  placeName: string | null
  language: string
  region: string
  syncEnabled: boolean
  syncIntervalMinutes: number | null
  lastReportedTotal: number | null
  lastSyncedAt: string | null
  lastSuccessfulRunAt: string | null
  nextScheduledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminReviewCrawlRun {
  id: string
  status: ReviewCrawlRunStatus
  strategy: ReviewCrawlRunStrategy
  priority: ReviewCrawlRunPriority
  extractedCount: number
  validCount: number
  warningCount: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  sourceId: string
  intakeBatchId: string | null
}

export interface ReviewCrawlRunIntakeBatchRef {
  id: string
  status: ReviewIntakeBatchStatus
  title: string | null
}

export interface ReviewCrawlCoveragePolicy {
  code: string
  actionRequired: boolean
  summary: string
}

export interface ReviewCrawlCoverage {
  completeness: string
  reportedTotal: number | null
  extractedCount: number
  reportedTotalDelta: number | null
  mismatchStatus: string
  mismatchDetected: boolean
  publicReviewChainExhausted: boolean
  stopReason: string | null
  operatorPolicy: ReviewCrawlCoveragePolicy
}

export interface ReviewCrawlRun {
  id: string
  sourceId: string
  restaurantId: string
  requestedByUserId: string | null
  intakeBatchId: string | null
  strategy: ReviewCrawlRunStrategy
  status: ReviewCrawlRunStatus
  priority: ReviewCrawlRunPriority
  reportedTotal: number | null
  extractedCount: number
  validCount: number
  skippedCount: number
  duplicateCount: number
  warningCount: number
  pagesFetched: number
  pageSize: number
  delayMs: number
  maxPages: number | null
  maxReviews: number | null
  checkpointCursor: string | null
  knownReviewStreak: number
  cancelRequestedAt: string | null
  leaseExpiresAt: string | null
  errorCode: string | null
  errorMessage: string | null
  warnings: string[]
  metadata: Record<string, unknown>
  crawlCoverage: ReviewCrawlCoverage | null
  queuedAt: string
  startedAt: string | null
  lastCheckpointAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
  source?: ReviewCrawlSource | null
  intakeBatch?: ReviewCrawlRunIntakeBatchRef | null
}

export interface ReviewOpsSource extends ReviewCrawlSource {
  latestRun: ReviewCrawlRun | null
  openDraftBatch: ReviewCrawlRunIntakeBatchRef | null
  overdueForSync: boolean
}

export interface ReviewOpsSourcesResponse {
  restaurantId: string
  queueHealth: Record<string, unknown> | null
  workerHealth: Record<string, unknown> | null
  overdueSourceCount: number
  sources: ReviewOpsSource[]
}

export interface ReviewOpsRunListResponse {
  source: ReviewCrawlSource | null
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
  runs: ReviewCrawlRun[]
}

export interface ReviewOpsRunDetailResponse {
  run: ReviewCrawlRun & {
    resumable: boolean
    materializable: boolean
  }
  queueJob: {
    id: string
    name: string
    state: string | null
    attemptsMade: number
    timestamp: number
    processedOn: number | null
    finishedOn: number | null
  } | null
}

export interface ReviewOpsSyncDraftInput {
  restaurantId: string
  url: string
  language?: string
  region?: string
  strategy?: ReviewCrawlRunStrategy
  priority?: ReviewCrawlRunPriority
  maxPages?: number
  maxReviews?: number
  pageSize?: number
  delayMs?: number
}

export interface ReviewOpsSyncDraftResult {
  source: ReviewCrawlSource
  run: ReviewCrawlRun
  draftPolicy: {
    mode: 'DRAFT'
    publishMode: 'MANUAL'
    appendToOpenDraft: boolean
    activeDraftBatchId: string | null
    sourceId: string
    reusedActiveRun: boolean
  }
}

export interface ReviewOpsBatchReadiness {
  batch: ReviewIntakeBatch
  counts: ReviewIntakeBatchCounts
  bulkApprovableCount: number
  publishAllowed: boolean
  blockingReasons: Array<{
    code: string
    message: string
    count?: number
    items?: Array<{
      itemId: string
      code: string
      message: string
    }>
  }>
  crawlDiagnostics: {
    skippedInvalidCount: number
    topValidationIssues: Array<{
      code: string
      count: number
    }>
  }
}

export interface ReviewOpsApproveValidResult {
  batch: ReviewIntakeBatch
  approvedCount: number
  skippedCount: number
}

export interface ReviewCrawlPreviewInput {
  restaurantId: string
  url: string
  language?: string
  region?: string
  sort?: 'relevant' | 'newest' | 'highest_rating' | 'lowest_rating'
  searchQuery?: string
  pages?: number | 'max'
  pageSize?: number
  maxReviews?: number
  delayMs?: number
}

export interface UpsertReviewCrawlSourceInput {
  restaurantId: string
  url: string
  language?: string
  region?: string
  syncEnabled?: boolean
  syncIntervalMinutes?: number
}

export interface CreateReviewCrawlRunInput {
  strategy?: ReviewCrawlRunStrategy
  priority?: ReviewCrawlRunPriority
  maxPages?: number
  maxReviews?: number
  pageSize?: number
  delayMs?: number
}

export interface ReviewCrawlPreviewResult {
  schemaVersion: string
  source: Record<string, unknown>
  place: Record<string, unknown>
  reviews: Array<{
    reviewId?: string
    externalReviewKey?: string
    rating: number
    text?: string | null
    publishedAt?: string | null
    author?: {
      name?: string | null
    } | null
  }>
  intake: {
    items: CreateReviewIntakeItemInput[]
    validItemCount: number
    droppedReviewCount: number
    warnings: string[]
  }
  crawl: {
    status: string
    completeness: string
    fetchedPages: number
    totalReviewsExtracted: number
    exhaustedSource: boolean
    prematureExhaustionDetected: boolean
    resumeCursor?: string | null
    nextPageToken?: string | null
    pageLimitReached?: boolean
    reviewLimitReached?: boolean
    warnings: string[]
  }
}

export interface ReviewCrawlSourceUpsertResult {
  source: ReviewCrawlSource
  metadata: {
    placeName: string | null
    totalReviewCount: number | null
    googlePlaceId: string | null
    placeHexId: string | null
  }
}

export interface ReviewCrawlMaterializeResult {
  batch: ReviewIntakeBatch
  createdItemCount: number
  deduplicatedItemCount: number
  run: ReviewCrawlRun
}
