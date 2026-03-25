import { useEffect, useState } from 'react'
import { listReviewEvidence, type ReviewListResponse, type ReviewsQuery } from '../../lib/api'

interface UseReviewEvidenceOptions {
  enabled: boolean
  restaurantId: string | null
  refreshKey: number
  query: ReviewsQuery
  fallbackMessage: string
  onSessionExpiry: (error: unknown) => boolean
}

export function useReviewEvidence({
  enabled,
  restaurantId,
  refreshKey,
  query,
  fallbackMessage,
  onSessionExpiry,
}: UseReviewEvidenceOptions) {
  const [reviews, setReviews] = useState<ReviewListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !restaurantId) {
      setReviews(null)
      setError(null)
      setLoading(false)
      return
    }

    const currentRestaurantId = restaurantId
    let cancelled = false

    async function loadReviewEvidence() {
      setLoading(true)
      setError(null)

      try {
        const result = await listReviewEvidence(currentRestaurantId, query)

        if (!cancelled) {
          setReviews(result)
        }
      } catch (nextError) {
        if (cancelled) {
          return
        }

        if (!onSessionExpiry(nextError)) {
          setReviews(null)
          setError(nextError instanceof Error ? nextError.message : fallbackMessage)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReviewEvidence()

    return () => {
      cancelled = true
    }
  }, [enabled, fallbackMessage, onSessionExpiry, query, refreshKey, restaurantId])

  return {
    reviews,
    loading,
    error,
    reset: () => setReviews(null),
  }
}
