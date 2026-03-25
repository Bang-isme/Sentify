import { request } from './client'
import type { AuthResponse, LoginInput, RegisterInput, SessionResponse } from './types'

export function register(input: RegisterInput) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
  })
}

export function login(input: LoginInput) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
  })
}

export function getSession() {
  return request<SessionResponse>('/auth/session')
}

export function logout() {
  return request<{ message: string }>('/auth/logout', {
    method: 'POST',
  })
}
