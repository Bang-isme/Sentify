import { expect, test, type Browser, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS, SEED_RESTAURANTS } from './support/test-data'
import { goToRoute, loginAs, logout } from './support/session'

interface MerchantRestaurantSummary {
  id: string
  name: string
}

interface MerchantRestaurantDetail {
  id: string
  name: string
  datasetStatus: {
    lastPublishedAt: string | null
  }
  insightSummary: {
    totalReviews: number
  }
}

interface ReviewListResponse {
  data: Array<{
    id: string
    content: string | null
  }>
}

async function prepareSecondaryPage(page: Page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      await page.goto(LOCAL_URLS.webBaseUrl, { waitUntil: 'domcontentloaded' })
      await page.evaluate(() => window.localStorage.clear())
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(500)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Web UI did not become reachable in time.')
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

async function getReviewList(page: Page, restaurantId: string): Promise<ReviewListResponse> {
  const response = await page.context().request.get(
    `${LOCAL_URLS.apiBaseUrl}/restaurants/${restaurantId}/reviews?limit=100`,
  )

  expect(response.ok(), 'Expected merchant review evidence to return 2xx').toBeTruthy()

  return (await response.json()) as ReviewListResponse
}

async function pollUntil<T>(
  page: Page,
  action: () => Promise<T>,
  isReady: (value: T) => boolean,
  message: string,
  timeoutMs = 30_000,
  intervalMs = 500,
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

async function openMerchantWatcher(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await prepareSecondaryPage(page)
  return { context, page }
}

test.describe('ADMIN and USER parallel live flow', () => {
  test('merchant stays online while admin publishes a manual intake review', async ({
    browser,
    page: userPage,
  }) => {
    test.slow()

    const { context: adminContext, page: adminPage } = await openMerchantWatcher(browser)

    try {
      await userPage.goto('/')
      await userPage.evaluate(() => window.localStorage.clear())

      await loginAs(userPage, SEED_CREDENTIALS.userTacombi, 'USER')

      const merchantRestaurants = await getApiJson<MerchantRestaurantSummary[]>(userPage, '/restaurants')
      const targetRestaurant =
        merchantRestaurants.find((restaurant) =>
          restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.tacombi.toLowerCase()),
        ) ?? merchantRestaurants[0]

      expect(targetRestaurant).toBeTruthy()

      const beforeDetail = await getApiJson<MerchantRestaurantDetail>(
        userPage,
        `/restaurants/${targetRestaurant.id}`,
      )
      const beforePublishedAt = beforeDetail.datasetStatus.lastPublishedAt
      const beforeTotalReviews = beforeDetail.insightSummary.totalReviews

      await goToRoute(userPage, HASH_ROUTES.appReviews)
      await expect(userPage.getByTestId('merchant-reviews-screen')).toBeVisible()

      await loginAs(adminPage, SEED_CREDENTIALS.admin, 'ADMIN')
      await goToRoute(adminPage, HASH_ROUTES.adminRestaurants)
      await expect(adminPage.getByTestId('admin-overview')).toBeVisible()
      await adminPage
        .getByRole('button', { name: new RegExp(targetRestaurant.name, 'i') })
        .first()
        .click()

      await goToRoute(adminPage, HASH_ROUTES.adminIntake)
      await expect(adminPage.getByTestId('admin-intake')).toBeVisible()

      const batchTitle = `Playwright Parallel Intake ${Date.now()}`
      const publishedReviewContent = `Playwright parallel live review ${Date.now()}`

      await adminPage.getByTestId('admin-intake-batch-title-input').fill(batchTitle)
      await adminPage.getByTestId('admin-intake-create-batch-button').click()

      await expect(
        adminPage.getByRole('button', {
          name: new RegExp(batchTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        }),
      ).toBeVisible()
      await adminPage
        .getByRole('button', {
          name: new RegExp(batchTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        })
        .click()

      await adminPage.getByTestId('admin-intake-single-author-input').fill('Playwright Parallel Intake')
      await adminPage.getByTestId('admin-intake-single-rating-select').selectOption('4')
      await adminPage.getByTestId('admin-intake-single-date-input').fill('2026-03-26')
      await adminPage
        .getByTestId('admin-intake-single-content-input')
        .fill('Temporary draft content before parallel publish.')
      await adminPage.getByTestId('admin-intake-add-single-button').click()

      const contentEditor = adminPage.locator('[data-testid^="admin-intake-item-content-"]').first()
      const saveButton = adminPage.locator('[data-testid^="admin-intake-item-save-"]').first()
      const approveButton = adminPage.locator('[data-testid^="admin-intake-item-approve-"]').first()

      await expect(contentEditor).toBeVisible({ timeout: 10_000 })
      await contentEditor.fill(publishedReviewContent)
      await saveButton.click()
      await approveButton.click()

      const merchantRefreshPromise = pollUntil(
        userPage,
        () => getReviewList(userPage, targetRestaurant.id).catch(() => null),
        (reviews) =>
          Boolean(
            reviews?.data.some((review) => (review.content ?? '').includes(publishedReviewContent)),
          ),
        'The published manual intake review never appeared while the merchant session stayed online',
      )

      await expect(adminPage.getByTestId('admin-intake-publish-button')).toBeEnabled()
      await adminPage.getByTestId('admin-intake-publish-button').click()
      await expect(adminPage.getByTestId('admin-intake-publish-success')).toBeVisible()

      await merchantRefreshPromise

      const afterDetail = await getApiJson<MerchantRestaurantDetail>(
        userPage,
        `/restaurants/${targetRestaurant.id}`,
      )

      expect(afterDetail.datasetStatus.lastPublishedAt ?? beforePublishedAt).toBeTruthy()
      expect(afterDetail.insightSummary.totalReviews).toBeGreaterThanOrEqual(beforeTotalReviews)

      await goToRoute(userPage, HASH_ROUTES.appHome)
      await expect(userPage.getByTestId('merchant-home-screen')).toBeVisible()
      await goToRoute(userPage, HASH_ROUTES.appReviews)
      await expect(userPage.getByTestId('merchant-reviews-screen')).toBeVisible()
      await pollUntil(
        userPage,
        async () => userPage.getByText(publishedReviewContent).count(),
        (count) => count > 0,
        'The merchant reviews screen never rendered the newly published review within the live session',
        15_000,
      )

      await Promise.all([logout(adminPage), logout(userPage)])
    } finally {
      await adminContext.close()
    }
  })
})
