import { useEffect, useState } from 'react'
import {
  getComplaintKeywords,
  getDashboardKpi,
  getSentimentBreakdown,
  getTrend,
  type ComplaintKeyword,
  type InsightSummary,
  type SentimentBreakdownRow,
  type TrendPeriod,
  type TrendPoint,
} from '../../lib/api'

export interface DashboardState {
  kpi: InsightSummary | null
  sentiment: SentimentBreakdownRow[]
  trend: TrendPoint[]
  complaints: ComplaintKeyword[]
}

const EMPTY_DASHBOARD: DashboardState = {
  kpi: null,
  sentiment: [],
  trend: [],
  complaints: [],
}

interface UseDashboardDataOptions {
  enabled: boolean
  restaurantId: string | null
  refreshKey: number
  trendPeriod: TrendPeriod
  fallbackMessage: string
  onSessionExpiry: (error: unknown) => boolean
}

export function useDashboardData({
  enabled,
  restaurantId,
  refreshKey,
  trendPeriod,
  fallbackMessage,
  onSessionExpiry,
}: UseDashboardDataOptions) {
  const [dashboard, setDashboard] = useState<DashboardState>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !restaurantId) {
      setDashboard(EMPTY_DASHBOARD)
      setError(null)
      setLoading(false)
      return
    }

    const currentRestaurantId = restaurantId
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError(null)

      try {
        const [kpi, sentiment, trend, complaints] = await Promise.all([
          getDashboardKpi(currentRestaurantId),
          getSentimentBreakdown(currentRestaurantId),
          getTrend(currentRestaurantId, trendPeriod),
          getComplaintKeywords(currentRestaurantId),
        ])

        if (!cancelled) {
          setDashboard({
            kpi,
            sentiment,
            trend,
            complaints,
          })
        }
      } catch (nextError) {
        if (cancelled) {
          return
        }

        if (!onSessionExpiry(nextError)) {
          setDashboard(EMPTY_DASHBOARD)
          setError(nextError instanceof Error ? nextError.message : fallbackMessage)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [enabled, fallbackMessage, onSessionExpiry, refreshKey, restaurantId, trendPeriod])

  return {
    dashboard,
    loading,
    error,
    reset: () => setDashboard(EMPTY_DASHBOARD),
  }
}
