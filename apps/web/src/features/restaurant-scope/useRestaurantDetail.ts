import { useEffect, useState } from 'react'
import { getRestaurantDetail, type RestaurantDetail } from '../../lib/api'

interface UseRestaurantDetailOptions {
  enabled: boolean
  restaurantId: string | null
  refreshKey: number
  fallbackMessage: string
  onSessionExpiry: (error: unknown) => boolean
}

export function useRestaurantDetail({
  enabled,
  restaurantId,
  refreshKey,
  fallbackMessage,
  onSessionExpiry,
}: UseRestaurantDetailOptions) {
  const [detail, setDetail] = useState<RestaurantDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !restaurantId) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    const currentRestaurantId = restaurantId
    let cancelled = false

    async function loadRestaurantDetail() {
      setLoading(true)
      setError(null)

      try {
        const nextDetail = await getRestaurantDetail(currentRestaurantId)

        if (!cancelled) {
          setDetail(nextDetail)
        }
      } catch (nextError) {
        if (cancelled) {
          return
        }

        if (!onSessionExpiry(nextError)) {
          setDetail(null)
          setError(nextError instanceof Error ? nextError.message : fallbackMessage)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRestaurantDetail()

    return () => {
      cancelled = true
    }
  }, [enabled, fallbackMessage, onSessionExpiry, refreshKey, restaurantId])

  return {
    detail,
    loading,
    error,
    setDetail,
    setError,
  }
}
