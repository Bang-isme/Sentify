import { request } from './client'
import type {
  CreateAdminUserInput,
  AdminMembershipListResponse,
  AdminMembershipMutationResult,
  AdminUserDetailResponse,
  AdminUserListResponse,
  AdminUserPasswordResetResult,
  CreateAdminMembershipInput,
  ListAdminMembershipsQuery,
  ListAdminUsersQuery,
  UpdateAdminUserAccountStateInput,
  UpdateAdminUserRoleInput,
} from './types'

function withQuery(path: string, query?: Record<string, string | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      params.set(key, value)
    }
  }

  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

export function listAdminUsers(query: ListAdminUsersQuery = {}) {
  return request<AdminUserListResponse>(
    withQuery('/admin/users', {
      search: query.search?.trim() || undefined,
      role: query.role || undefined,
      accountState: query.accountState || undefined,
    }),
  )
}

export function getAdminUserDetail(userId: string) {
  return request<AdminUserDetailResponse>(`/admin/users/${userId}`)
}

export function createAdminUser(input: CreateAdminUserInput) {
  return request<AdminUserDetailResponse>('/admin/users', {
    method: 'POST',
    body: input,
  })
}

export function updateAdminUserRole(userId: string, input: UpdateAdminUserRoleInput) {
  return request<AdminUserDetailResponse>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: input,
  })
}

export function updateAdminUserAccountState(
  userId: string,
  input: UpdateAdminUserAccountStateInput,
) {
  return request<AdminUserDetailResponse>(`/admin/users/${userId}/account-state`, {
    method: 'PATCH',
    body: input,
  })
}

export function triggerAdminUserPasswordReset(userId: string) {
  return request<AdminUserPasswordResetResult>(`/admin/users/${userId}/password-reset`, {
    method: 'POST',
  })
}

export function listAdminMemberships(query: ListAdminMembershipsQuery = {}) {
  return request<AdminMembershipListResponse>(
    withQuery('/admin/memberships', {
      userId: query.userId || undefined,
      restaurantId: query.restaurantId || undefined,
    }),
  )
}

export function createAdminMembership(input: CreateAdminMembershipInput) {
  return request<AdminMembershipMutationResult>('/admin/memberships', {
    method: 'POST',
    body: input,
  })
}

export function deleteAdminMembership(membershipId: string) {
  return request<AdminMembershipMutationResult>(`/admin/memberships/${membershipId}`, {
    method: 'DELETE',
  })
}
