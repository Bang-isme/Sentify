import { request } from './client'
import type { AdminRestaurantDetail, AdminRestaurantSummary } from './types'

export function listAdminRestaurants() {
  return request<AdminRestaurantSummary[]>('/admin/restaurants')
}

export function getAdminRestaurantDetail(restaurantId: string) {
  return request<AdminRestaurantDetail>(`/admin/restaurants/${restaurantId}`)
}
