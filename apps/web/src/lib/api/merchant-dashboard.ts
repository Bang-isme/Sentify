import { buildUrl, request } from './client'
import type {
  ComplaintKeyword,
  InsightSummary,
  SentimentBreakdownRow,
  TrendPeriod,
  TrendPoint,
} from './types'

export function getDashboardKpi(restaurantId: string) {
  return request<InsightSummary>(`/restaurants/${restaurantId}/dashboard/kpi`)
}

export function getSentimentBreakdown(restaurantId: string) {
  return request<SentimentBreakdownRow[]>(`/restaurants/${restaurantId}/dashboard/sentiment`)
}

export function getTrend(restaurantId: string, period: TrendPeriod) {
  const url = buildUrl(`/restaurants/${restaurantId}/dashboard/trend`, { period })
  return request<TrendPoint[]>(`${url.pathname}${url.search}`)
}

export function getComplaintKeywords(restaurantId: string) {
  return request<ComplaintKeyword[]>(`/restaurants/${restaurantId}/dashboard/complaints`)
}
