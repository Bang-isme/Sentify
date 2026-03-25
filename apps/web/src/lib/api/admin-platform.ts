import { request } from './client'
import type {
  AdminAuditResponse,
  AdminHealthJobsResponse,
  AdminIntegrationsPoliciesResponse,
} from './types'

export function getAdminHealthJobs() {
  return request<AdminHealthJobsResponse>('/admin/platform/health-jobs')
}

export function getAdminIntegrationsPolicies() {
  return request<AdminIntegrationsPoliciesResponse>('/admin/platform/integrations-policies')
}

export function getAdminAudit(limit = 25) {
  return request<AdminAuditResponse>(`/admin/platform/audit?limit=${limit}`)
}
