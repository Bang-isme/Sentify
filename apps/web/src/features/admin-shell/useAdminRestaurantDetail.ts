import { useEffect, useState } from 'react'
import { getAdminRestaurantDetail, type AdminRestaurantDetail } from '../../lib/api'

interface UseAdminRestaurantDetailOptions {
  enabled: boolean
  restaurantId: string | null
  refreshKey: number
  fallbackMessage: string
  onSessionExpiry: (error: unknown) => boolean
}

export function useAdminRestaurantDetail({
  enabled,
  restaurantId,
  refreshKey,
  fallbackMessage,
  onSessionExpiry,
}: UseAdminRestaurantDetailOptions) {
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null)
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

    async function loadAdminRestaurantDetail() {
      setLoading(true)
      setError(null)

      try {
        const nextDetail = await getAdminRestaurantDetail(currentRestaurantId)

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

    void loadAdminRestaurantDetail()

    return () => {
      cancelled = true
    }
  }, [enabled, fallbackMessage, onSessionExpiry, refreshKey, restaurantId])

  return {
    detail,
    loading,
    error,
  }
}
