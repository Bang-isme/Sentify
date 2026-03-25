import { request } from './client'
import type { ReviewListResponse, ReviewsQuery } from './types'

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
