import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS, SEED_RESTAURANTS } from './support/test-data'
import { goToRoute, loginAs, logout } from './support/session'

interface AdminRestaurantSummary {
  id: string
  name: string
  googleMapUrl: string | null
}

interface ReviewOpsSourceSummary {
  id: string
  inputUrl: string
  latestRun: {
    id: string
    status: string
    updatedAt: string
  } | null
}

interface ReviewOpsSourcesResponse {
  sources: ReviewOpsSourceSummary[]
}

interface ReviewOpsRunListResponse {
  runs: Array<{
    id: string
    status: string
    updatedAt: string
  }>
}

interface ReviewCrawlRunDetail {
  id: string
  status: string
  extractedCount: number
  validCount: number
  intakeBatchId: string | null
  intakeBatch: {
    id: string
    status: string
    title: string | null
  } | null
  crawlCoverage: {
    completeness: string
  } | null
}

interface ReviewOpsBatchReadiness {
  batch: {
    id: string
  }
  bulkApprovableCount: number
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

test.describe('ADMIN crawl operations', () => {
  test('admin can preview, run, and materialize crawl output from the crawl operations screen', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')

    const adminRestaurants = await getApiJson<AdminRestaurantSummary[]>(page, '/admin/restaurants')
    const seededRestaurant =
      adminRestaurants.find((restaurant) =>
        restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.phoHong.toLowerCase()),
      ) ?? null
    const fallbackRestaurant =
      adminRestaurants.find(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.tacombi.toLowerCase()) &&
          Boolean(restaurant.googleMapUrl),
      ) ?? adminRestaurants.find((restaurant) => Boolean(restaurant.googleMapUrl))
    const targetRestaurant = seededRestaurant ?? fallbackRestaurant

    expect(targetRestaurant).toBeTruthy()

    await goToRoute(page, HASH_ROUTES.adminRestaurants)
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await page
      .getByRole('button', { name: new RegExp(targetRestaurant?.name as string, 'i') })
      .first()
      .click()

    await goToRoute(page, HASH_ROUTES.adminReviewCrawl)
    await expect(page.getByTestId('admin-crawl')).toBeVisible()

    const beforeSources = await getApiJson<ReviewOpsSourcesResponse>(page, `/admin/review-ops/sources?restaurantId=${targetRestaurant?.id}`)
    const configuredUrl =
      beforeSources.sources[0]?.inputUrl ?? targetRestaurant?.googleMapUrl ?? ''
    expect(configuredUrl).toMatch(/^https?:\/\//)

    await page.getByTestId('review-crawl-preview-url-input').fill(configuredUrl)
    await page.getByTestId('review-crawl-preview-max-pages-input').fill('1')
    await page.getByTestId('review-crawl-preview-max-reviews-input').fill('10')
    await page.getByTestId('review-crawl-preview-button').click()

    await expect(page.getByTestId('review-crawl-preview-valid-count')).toContainText(/[1-9]\d* valid review/i, {
      timeout: 30_000,
    })

    const previousSource = beforeSources.sources.find((source) => source.inputUrl === configuredUrl)
    const previousLatestRun = previousSource?.latestRun

    await page.getByTestId('review-crawl-source-url-input').fill(configuredUrl)
    await page.getByTestId('review-crawl-upsert-source-button').click()

    const sourceAfterUpsert = await pollUntil(
      page,
      () =>
        getApiJson<ReviewOpsSourcesResponse>(
          page,
          `/admin/review-ops/sources?restaurantId=${targetRestaurant?.id}`,
        ).then(
          (response) => response.sources.find((source) => source.inputUrl === configuredUrl) ?? null,
        ),
      (source) => Boolean(source),
      'The crawl source did not persist from the crawl operations screen',
    )

    await page.getByTestId(`review-crawl-source-row-${sourceAfterUpsert.id}`).click()
    await page.getByTestId('review-crawl-run-max-pages-input').fill('1')
    await page.getByTestId('review-crawl-run-max-reviews-input').fill('10')
    await page.getByTestId('review-crawl-run-page-size-input').fill('10')
    await page.getByTestId('review-crawl-run-delay-input').fill('100')

    const actionStartedAt = Date.now()
    await page.getByTestId('review-crawl-create-run-button').click()

    const createdRun = await pollUntil(
      page,
      () =>
        getApiJson<ReviewOpsRunListResponse>(
          page,
          `/admin/review-ops/sources/${sourceAfterUpsert.id}/runs?page=1&limit=20`,
        ).then((response) => response.runs[0] ?? null),
      (run) =>
        Boolean(
          run &&
            Date.parse(run.updatedAt) >= actionStartedAt - 1_000 &&
            (
              run.id !== previousLatestRun?.id ||
              Date.parse(run.updatedAt) >
                Date.parse(previousLatestRun?.updatedAt ?? '1970-01-01T00:00:00.000Z')
            ),
        ),
      'The crawl operations screen did not create a fresh run',
    )

    await page.getByTestId(`review-crawl-run-row-${createdRun.id}`).click()

    const completedRun = await pollUntil(
      page,
      () => getApiJson<ReviewCrawlRunDetail>(page, `/admin/review-crawl/runs/${createdRun.id}`),
      (run) =>
        ['PARTIAL', 'COMPLETED'].includes(run.status) &&
        run.extractedCount > 0 &&
        run.validCount > 0,
      'The crawl run never reached a usable terminal state',
    )

    expect(completedRun.intakeBatchId).toBeNull()

    await page.getByTestId('review-crawl-refresh-run-button').click()
    await page.getByTestId('review-crawl-materialize-button').click()

    const materializedRun = await pollUntil(
      page,
      () => getApiJson<ReviewCrawlRunDetail>(page, `/admin/review-crawl/runs/${createdRun.id}`),
      (run) => Boolean(run.intakeBatchId && run.intakeBatch?.id),
      'The crawl run never materialized into an intake batch',
    )

    expect(materializedRun.crawlCoverage?.completeness).toBeTruthy()

    const readiness = await getApiJson<ReviewOpsBatchReadiness>(
      page,
      `/admin/review-ops/batches/${materializedRun.intakeBatchId}/readiness`,
    )

    expect(readiness.batch.id).toBe(materializedRun.intakeBatchId)
    expect(readiness.bulkApprovableCount).toBeGreaterThan(0)

    await logout(page)
  })
})
