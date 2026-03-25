import { request } from './client'
import type {
  CreateRestaurantInput,
  RestaurantDetail,
  RestaurantMembership,
  UpdateRestaurantInput,
} from './types'

export function listRestaurants() {
  return request<RestaurantMembership[]>('/restaurants')
}

export function createRestaurant(input: CreateRestaurantInput) {
  return request<RestaurantMembership>('/restaurants', {
    method: 'POST',
    body: input,
  })
}

export function getRestaurantDetail(restaurantId: string) {
  return request<RestaurantDetail>(`/restaurants/${restaurantId}`)
}

export function updateRestaurant(restaurantId: string, input: UpdateRestaurantInput) {
  return request<RestaurantDetail>(`/restaurants/${restaurantId}`, {
    method: 'PATCH',
    body: input,
  })
}
