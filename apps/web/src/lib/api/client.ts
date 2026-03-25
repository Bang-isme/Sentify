import { ApiClientError, type ApiErrorPayload } from './types'

const DEFAULT_LOCAL_DEV_API_BASE_URL = 'http://localhost:3000/api'
const ACCESS_COOKIE_NAME = 'sentify_access_token'
const REFRESH_COOKIE_NAME = 'sentify_refresh_token'
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const ENV_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '')

const API_BASE_URL = ENV_API_BASE_URL
  ? ENV_API_BASE_URL
  : import.meta.env.DEV
    ? DEFAULT_LOCAL_DEV_API_BASE_URL
    : '/api'

interface ApiRequestOptions {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST'
  skipSessionRefresh?: boolean
  token?: string
  unwrapData?: boolean
}

function resolveApiBaseUrl() {
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return API_BASE_URL
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return new URL(API_BASE_URL, origin).toString().replace(/\/$/, '')
}

export function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${resolveApiBaseUrl()}${path}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url
}

function readCookie(name: string) {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const cookiePairs = document.cookie.split('; ')

  for (const pair of cookiePairs) {
    const separatorIndex = pair.indexOf('=')
    const key = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex)

    if (key !== name) {
      continue
    }

    const rawValue = separatorIndex === -1 ? '' : pair.slice(separatorIndex + 1)

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}

function hasSessionCookies() {
  return Boolean(readCookie(ACCESS_COOKIE_NAME) || readCookie(REFRESH_COOKIE_NAME))
}

let refreshPromise: Promise<boolean> | null = null

async function issueCsrfCookie() {
  const response = await fetch(buildUrl('/auth/csrf'), {
    method: 'GET',
    credentials: 'include',
    headers: new Headers({
      Accept: 'application/json',
    }),
  })

  return response.ok
}

async function ensureCsrfHeader(headers: Headers) {
  if (headers.has(CSRF_HEADER_NAME)) {
    return
  }

  let csrfToken = readCookie(CSRF_COOKIE_NAME)

  if (!csrfToken && hasSessionCookies()) {
    try {
      await issueCsrfCookie()
    } catch {
      // Let the original write request fail with the backend's CSRF error if bootstrap fails.
    }

    csrfToken = readCookie(CSRF_COOKIE_NAME)
  }

  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }
}

async function refreshSession() {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      await issueCsrfCookie()

      const headers = new Headers({
        Accept: 'application/json',
      })
      const csrfToken = readCookie(CSRF_COOKIE_NAME)

      if (csrfToken) {
        headers.set(CSRF_HEADER_NAME, csrfToken)
      }

      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers,
      })

      return response.ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers({
    Accept: 'application/json',
  })

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  if (!options.token && !SAFE_METHODS.has(method)) {
    await ensureCsrfHeader(headers)
  }

  const response = await fetch(buildUrl(path), {
    method,
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: ApiErrorPayload }
    | T
    | null

  if (
    response.status === 401 &&
    !options.skipSessionRefresh &&
    !options.token &&
    hasSessionCookies() &&
    path !== '/auth/refresh' &&
    path !== '/auth/login' &&
    path !== '/auth/register'
  ) {
    const refreshed = await refreshSession()

    if (refreshed) {
      return request<T>(path, {
        ...options,
        skipSessionRefresh: true,
      })
    }
  }

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' && 'error' in payload && payload.error
        ? payload.error
        : {
            code: 'REQUEST_FAILED',
            message: 'Request failed',
          }

    throw new ApiClientError(response.status, errorPayload)
  }

  if (options.unwrapData === false) {
    return payload as T
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}
