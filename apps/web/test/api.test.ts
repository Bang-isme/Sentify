import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession, getTrend, listReviewIntakeBatches, listReviewOpsSourceRuns, listReviewOpsSources, logout } from '../src/lib/api'
import { ApiClientError } from '../src/lib/api'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

describe('api client auth handshake', () => {
  beforeEach(() => {
    clearCookie('sentify_access_token')
    clearCookie('sentify_refresh_token')
    clearCookie('XSRF-TOKEN')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCookie('sentify_access_token')
    clearCookie('sentify_refresh_token')
    clearCookie('XSRF-TOKEN')
  })

  it('adds the csrf header to cookie-authenticated write requests', async () => {
    setCookie('XSRF-TOKEN', 'csrf-cookie-token')

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          message: 'Logged out successfully',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await logout()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [URL | string, RequestInit]
    const headers = new Headers(requestInit.headers)

    expect(String(requestUrl)).toContain('/api/auth/logout')
    expect(requestInit.method).toBe('POST')
    expect(requestInit.credentials).toBe('include')
    expect(headers.get('X-CSRF-Token')).toBe('csrf-cookie-token')
  })

  it('bootstraps csrf, refreshes the session, and retries the failed request once', async () => {
    setCookie('sentify_refresh_token', 'refresh-cookie-token')

    const fetchMock = vi.fn(async (requestUrl: URL | string, requestInit?: RequestInit) => {
      const url = String(requestUrl)

      if (url.includes('/api/auth/session') && fetchMock.mock.calls.length === 1) {
        return jsonResponse(
          {
            error: {
              code: 'AUTH_ACCESS_TOKEN_EXPIRED',
              message: 'Access token expired',
            },
          },
          401,
        )
      }

      if (url.includes('/api/auth/csrf')) {
        setCookie('XSRF-TOKEN', 'bootstrapped-csrf-token')
        return new Response(null, { status: 204 })
      }

      if (url.includes('/api/auth/refresh')) {
        const headers = new Headers(requestInit?.headers)

        expect(headers.get('X-CSRF-Token')).toBe('bootstrapped-csrf-token')
        setCookie('sentify_access_token', 'fresh-access-cookie')
        setCookie('XSRF-TOKEN', 'rotated-csrf-token')

        return jsonResponse({
          data: {
            expiresIn: 900,
          },
        })
      }

      if (url.includes('/api/auth/session')) {
        return jsonResponse({
          data: {
            user: {
              id: 'user-1',
              email: 'owner@sentify.test',
              fullName: 'Owner User',
              restaurants: [],
            },
          },
        })
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await getSession()

    expect(result.user.email).toBe('owner@sentify.test')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/session')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/auth/csrf')
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/api/auth/refresh')
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain('/api/auth/session')
  })

  it('does not attempt a refresh when no session cookies exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Access token is required',
          },
        },
        401,
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(getSession()).rejects.toBeInstanceOf(ApiClientError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/session')
  })

  it('builds query endpoints without duplicating the api prefix', async () => {
    const fetchMock = vi.fn(async (requestUrl: URL | string) => {
      const url = String(requestUrl)

      if (url.includes('/admin/review-ops/sources/source-1/runs')) {
        return jsonResponse({ data: { source: null, pagination: {}, runs: [] } })
      }

      if (url.includes('/admin/review-ops/sources')) {
        return jsonResponse({ data: { restaurantId: 'restaurant-1', sources: [] } })
      }

      if (url.includes('/admin/review-batches')) {
        return jsonResponse({ data: [] })
      }

      if (url.includes('/dashboard/trend')) {
        return jsonResponse({ data: [] })
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    await listReviewOpsSources('restaurant-1')
    await listReviewOpsSourceRuns('source-1', 2, 25)
    await listReviewIntakeBatches('restaurant-1')
    await getTrend('restaurant-1', 'month')

    const calledUrls = fetchMock.mock.calls.map(([requestUrl]) => String(requestUrl))

    expect(calledUrls).toContain(
      'http://localhost:3000/api/admin/review-ops/sources?restaurantId=restaurant-1',
    )
    expect(calledUrls).toContain(
      'http://localhost:3000/api/admin/review-ops/sources/source-1/runs?page=2&limit=25',
    )
    expect(calledUrls).toContain(
      'http://localhost:3000/api/admin/review-batches?restaurantId=restaurant-1',
    )
    expect(calledUrls).toContain(
      'http://localhost:3000/api/restaurants/restaurant-1/dashboard/trend?period=month',
    )
    expect(calledUrls.some((url) => url.includes('/api/api/'))).toBe(false)
  })
})
