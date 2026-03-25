import { request } from './client'
import type {
  CreateReviewCrawlRunInput,
  ReviewCrawlMaterializeResult,
  ReviewCrawlPreviewInput,
  ReviewCrawlPreviewResult,
  ReviewCrawlRun,
  ReviewCrawlSourceUpsertResult,
  UpsertReviewCrawlSourceInput,
} from './types'

export function previewGoogleMapsReviews(input: ReviewCrawlPreviewInput) {
  return request<ReviewCrawlPreviewResult>('/admin/review-crawl/google-maps', {
    method: 'POST',
    body: input,
  })
}

export function upsertReviewCrawlSource(input: UpsertReviewCrawlSourceInput) {
  return request<ReviewCrawlSourceUpsertResult>('/admin/review-crawl/sources', {
    method: 'POST',
    body: input,
  })
}

export function createReviewCrawlRun(sourceId: string, input: CreateReviewCrawlRunInput) {
  return request<ReviewCrawlRun>(`/admin/review-crawl/sources/${sourceId}/runs`, {
    method: 'POST',
    body: input,
  })
}

export function getReviewCrawlRun(runId: string) {
  return request<ReviewCrawlRun>(`/admin/review-crawl/runs/${runId}`)
}

export function cancelReviewCrawlRun(runId: string) {
  return request<ReviewCrawlRun>(`/admin/review-crawl/runs/${runId}/cancel`, {
    method: 'POST',
  })
}

export function resumeReviewCrawlRun(runId: string) {
  return request<ReviewCrawlRun>(`/admin/review-crawl/runs/${runId}/resume`, {
    method: 'POST',
  })
}

export function materializeReviewCrawlRun(runId: string) {
  return request<ReviewCrawlMaterializeResult>(`/admin/review-crawl/runs/${runId}/materialize-intake`, {
    method: 'POST',
  })
}
