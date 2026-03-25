import { buildUrl, request } from './client'
import type {
  CreateReviewIntakeBatchInput,
  CreateReviewIntakeItemInput,
  PublishReviewIntakeBatchResult,
  ReviewIntakeBatch,
  UpdateReviewIntakeItemInput,
} from './types'

export function createReviewIntakeBatch(input: CreateReviewIntakeBatchInput) {
  return request<ReviewIntakeBatch>('/admin/review-batches', {
    method: 'POST',
    body: input,
  })
}

export function listReviewIntakeBatches(restaurantId: string) {
  const url = buildUrl('/admin/review-batches', { restaurantId })
  return request<ReviewIntakeBatch[]>(`${url.pathname}${url.search}`)
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
