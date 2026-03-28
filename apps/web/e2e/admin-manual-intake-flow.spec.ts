import { expect, test, type Page } from '@playwright/test'
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

test.describe('ADMIN manual intake flow', () => {
  test('manual intake can create, curate, publish, and become merchant-visible evidence', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    await loginAs(page, SEED_CREDENTIALS.userTacombi, 'USER')

    const merchantRestaurants = await getApiJson<MerchantRestaurantSummary[]>(page, '/restaurants')
    const targetRestaurant =
      merchantRestaurants.find((restaurant) =>
        restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.tacombi.toLowerCase()),
      ) ?? merchantRestaurants[0]

    expect(targetRestaurant).toBeTruthy()

    const beforeDetail = await getApiJson<MerchantRestaurantDetail>(
      page,
      `/restaurants/${targetRestaurant.id}`,
    )
    const beforePublishedAt = beforeDetail.datasetStatus.lastPublishedAt
    const beforeTotalReviews = beforeDetail.insightSummary.totalReviews

    await logout(page)

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')
    await goToRoute(page, HASH_ROUTES.adminRestaurants)
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await page
      .getByRole('button', { name: new RegExp(targetRestaurant.name, 'i') })
      .first()
      .click()

    await goToRoute(page, HASH_ROUTES.adminIntake)
    await expect(page.getByTestId('admin-intake')).toBeVisible()

    const batchTitle = `Playwright Manual Intake ${Date.now()}`
    const publishedReviewContent = `Playwright manual intake review ${Date.now()}`

    await page.getByTestId('admin-intake-batch-title-input').fill(batchTitle)
    await page.getByTestId('admin-intake-create-batch-button').click()

    await expect(
      page.getByRole('button', { name: new RegExp(batchTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }),
    ).toBeVisible()

    await page.getByTestId('admin-intake-single-author-input').fill('Playwright Manual Intake')
    await page.getByTestId('admin-intake-single-rating-select').selectOption('4')
    await page.getByTestId('admin-intake-single-date-input').fill('2026-03-26')
    await page
      .getByTestId('admin-intake-single-content-input')
      .fill('Temporary draft content before curation.')
    await page.getByTestId('admin-intake-add-single-button').click()

    const contentEditor = page.locator('[data-testid^="admin-intake-item-content-"]').first()
    const saveButton = page.locator('[data-testid^="admin-intake-item-save-"]').first()
    const approveButton = page.locator('[data-testid^="admin-intake-item-approve-"]').first()

    await expect(contentEditor).toBeVisible()
    await contentEditor.fill(publishedReviewContent)
    await saveButton.click()
    await approveButton.click()

    await expect(page.getByTestId('admin-intake-publish-button')).toBeEnabled()
    await page.getByTestId('admin-intake-publish-button').click()
    await expect(page.getByTestId('admin-intake-publish-success')).toBeVisible()

    await logout(page)

    await loginAs(page, SEED_CREDENTIALS.userTacombi, 'USER')

    await pollUntil(
      page,
      () => getReviewList(page, targetRestaurant.id),
      (reviews) =>
        reviews.data.some((review) => (review.content ?? '').includes(publishedReviewContent)),
      'The published manual intake review never appeared in merchant review evidence',
    )

    const afterDetail = await getApiJson<MerchantRestaurantDetail>(
      page,
      `/restaurants/${targetRestaurant.id}`,
    )

    expect(afterDetail.datasetStatus.lastPublishedAt ?? beforePublishedAt).toBeTruthy()
    expect(afterDetail.insightSummary.totalReviews).toBeGreaterThanOrEqual(beforeTotalReviews)

    await goToRoute(page, HASH_ROUTES.appReviews)
    await expect(page.getByTestId('merchant-reviews-screen')).toBeVisible()
    await expect(page.getByText(publishedReviewContent)).toBeVisible()

    await logout(page)
  })
})
