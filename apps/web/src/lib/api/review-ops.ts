import { buildUrl, request } from './client'
import type {
  PublishReviewIntakeBatchResult,
  ReviewOpsApproveValidResult,
  ReviewOpsBatchReadiness,
  ReviewOpsRunDetailResponse,
  ReviewOpsRunListResponse,
  ReviewOpsSource,
  ReviewOpsSourcesResponse,
  ReviewOpsSyncDraftInput,
  ReviewOpsSyncDraftResult,
} from './types'

export function syncGoogleMapsToDraft(input: ReviewOpsSyncDraftInput) {
  return request<ReviewOpsSyncDraftResult>('/admin/review-ops/google-maps/sync-to-draft', {
    method: 'POST',
    body: input,
  })
}

export function listReviewOpsSources(restaurantId: string) {
  const url = buildUrl('/admin/review-ops/sources', { restaurantId })
  return request<ReviewOpsSourcesResponse>(`${url.pathname}${url.search}`)
}

export function listReviewOpsSourceRuns(sourceId: string, page = 1, limit = 20) {
  const url = buildUrl(`/admin/review-ops/sources/${sourceId}/runs`, { page, limit })
  return request<ReviewOpsRunListResponse>(`${url.pathname}${url.search}`)
}

export function getReviewOpsRunDetail(runId: string) {
  return request<ReviewOpsRunDetailResponse>(`/admin/review-ops/runs/${runId}`)
}

export function disableReviewOpsSource(sourceId: string) {
  return request<{ source: ReviewOpsSource }>(`/admin/review-ops/sources/${sourceId}/disable`, {
    method: 'POST',
  })
}

export function enableReviewOpsSource(sourceId: string) {
  return request<{ source: ReviewOpsSource }>(`/admin/review-ops/sources/${sourceId}/enable`, {
    method: 'POST',
  })
}

export function getReviewOpsBatchReadiness(batchId: string) {
  return request<ReviewOpsBatchReadiness>(`/admin/review-ops/batches/${batchId}/readiness`)
}

export function approveValidBatchItems(batchId: string, reviewerNote?: string) {
  return request<ReviewOpsApproveValidResult>(`/admin/review-ops/batches/${batchId}/approve-valid`, {
    method: 'POST',
    body: reviewerNote ? { reviewerNote } : {},
  })
}

export function publishReviewOpsBatch(batchId: string) {
  return request<PublishReviewIntakeBatchResult>(`/admin/review-ops/batches/${batchId}/publish`, {
    method: 'POST',
  })
}
