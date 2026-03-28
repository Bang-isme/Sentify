import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS, SEED_RESTAURANTS } from './support/test-data'
import { goToRoute, loginAs, logout } from './support/session'

const INVALID_SOURCE_URL = 'https://example.com/not-google-maps'

interface MerchantRestaurantSummary {
  id: string
  name: string
  googleMapUrl?: string | null
}

interface MerchantRestaurantDetail {
  id: string
  name: string
  googleMapUrl: string | null
}

interface AdminRestaurantSummary {
  id: string
  name: string
}

interface ReviewIntakeBatchResponse {
  id: string
  title: string | null
}

async function getApiJson<T>(page: Page, path: string): Promise<T> {
  const response = await page.context().request.get(`${LOCAL_URLS.apiBaseUrl}${path}`)

  expect(response.ok(), `Expected ${path} to return 2xx`).toBeTruthy()

  const payload = (await response.json()) as { data?: T } | T

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}

async function sendApiJson<T>(
  page: Page,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  await page.context().request.get(`${LOCAL_URLS.apiBaseUrl}/auth/csrf`)
  const csrfToken = await page.evaluate(() => {
    const xsrfCookiePrefix = ['XSRF-TOKEN', '='].join('')
    const rawCookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(xsrfCookiePrefix))

    if (!rawCookie) {
      return null
    }

    return decodeURIComponent(rawCookie.slice(xsrfCookiePrefix.length))
  })
  const response = await page.context().request.fetch(`${LOCAL_URLS.apiBaseUrl}${path}`, {
    method,
    data: body,
    headers: csrfToken
      ? {
          'X-CSRF-Token': csrfToken,
        }
      : undefined,
  })

  expect(response.ok(), `Expected ${method} ${path} to return 2xx`).toBeTruthy()

  if (response.status() === 204) {
    return undefined as T
  }

  const payload = (await response.json()) as { data?: T } | T

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }

  return payload as T
}

async function pollUntil<T>(
  page: Page,
  action: () => Promise<T>,
  isReady: (value: T) => boolean,
  message: string,
  timeoutMs = 90_000,
  intervalMs = 1_000,
) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await action()

    if (isReady(value)) {
      return value
    }

    await page.waitForTimeout(intervalMs)
  }

  throw new Error(message)
}

test.describe('ADMIN and USER guardrails', () => {
  test('merchant rejects non-Google source URLs and does not persist them', async ({ page }) => {
    await loginAs(page, SEED_CREDENTIALS.userPrimary, 'USER')
    await goToRoute(page, HASH_ROUTES.appSettings)
    await expect(page.getByTestId('merchant-settings-screen')).toBeVisible()

    const merchantRestaurants = await getApiJson<MerchantRestaurantSummary[]>(page, '/restaurants')
    const targetRestaurant = merchantRestaurants[0]

    expect(targetRestaurant).toBeTruthy()

    const beforeDetail = await getApiJson<MerchantRestaurantDetail>(
      page,
      `/restaurants/${targetRestaurant.id}`,
    )

    await page.getByTestId('merchant-google-maps-input').fill(INVALID_SOURCE_URL)
    await page.getByTestId('save-source').click()

    await expect(page.getByText(/Use a Google Maps URL|Hãy dùng URL Google Maps/i)).toBeVisible()

    const afterAttemptDetail = await getApiJson<MerchantRestaurantDetail>(
      page,
      `/restaurants/${targetRestaurant.id}`,
    )

    expect(afterAttemptDetail.googleMapUrl).toBe(beforeDetail.googleMapUrl)

    await logout(page)
  })

  test('admin intake keeps a draft blocked before any approval', async ({ page }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')
    const adminRestaurants = await getApiJson<AdminRestaurantSummary[]>(page, '/admin/restaurants')
    const targetRestaurant = adminRestaurants.find((restaurant) =>
      restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.tacombi.toLowerCase()),
    )

    expect(targetRestaurant).toBeTruthy()

    const batchTitle = `Playwright guardrail draft ${Date.now()}`
    const createdBatch = await sendApiJson<ReviewIntakeBatchResponse>(
      page,
      'POST',
      '/admin/review-batches',
      {
        restaurantId: targetRestaurant?.id,
        sourceType: 'MANUAL',
        title: batchTitle,
      },
    )

    try {
      await sendApiJson(
        page,
        'POST',
        `/admin/review-batches/${createdBatch.id}/items`,
        {
          items: [
            {
              rawAuthorName: 'Playwright Guardrail',
              rawRating: 5,
              rawContent: 'Pending draft item that should block publish until approval.',
            },
          ],
        },
      )

      await goToRoute(page, HASH_ROUTES.adminRestaurants)
      await expect(page.getByTestId('admin-overview')).toBeVisible()
      await page
        .getByRole('button', { name: new RegExp(SEED_RESTAURANTS.tacombi, 'i') })
        .first()
        .click()

      await goToRoute(page, HASH_ROUTES.adminIntake)
      await expect(page.getByTestId('admin-intake')).toBeVisible()

      await pollUntil(
        page,
        async () => page.getByTestId(`admin-intake-batch-select-${createdBatch.id}`).isVisible(),
        (isVisible) => isVisible,
        'The seeded intake draft did not appear in the admin intake queue',
      )

      await page.getByTestId(`admin-intake-batch-select-${createdBatch.id}`).click()

      await expect(page.getByTestId('admin-intake-publish-button')).toBeDisabled()
      await expect(page.getByTestId('admin-intake-publish-status')).toContainText(
        /Approve at least one item before publishing|approve ít nhất một item/i,
      )
    } finally {
      await sendApiJson(page, 'DELETE', `/admin/review-batches/${createdBatch.id}`)
      await logout(page)
    }
  })
})
