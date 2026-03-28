import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS } from './support/test-data'
import { goToRoute, loginAs, logout } from './support/session'

const GOOGLE_MAPS_SHORT_URL = 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7'

interface MerchantRestaurantSummary {
  id: string
  name: string
  googleMapUrl?: string | null
}

interface MerchantRestaurantDetail {
  id: string
  name: string
  googleMapUrl: string | null
  datasetStatus: {
    lastPublishedAt: string | null
    approvedItemCount: number
  }
  insightSummary: {
    totalReviews: number
  }
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

interface ReviewOpsRunDetailResponse {
  run: {
    id: string
    status: string
    intakeBatchId: string | null
  }
}

interface ReviewOpsBatchReadiness {
  counts: {
    approvedItems: number
  }
  bulkApprovableCount: number
  publishAllowed: boolean
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

test.describe('ADMIN and USER publication chain', () => {
  test('merchant saves a Google Maps URL, admin operationalizes it, and merchant sees the published dataset', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    await loginAs(page, SEED_CREDENTIALS.userPrimary, 'USER')
    await goToRoute(page, HASH_ROUTES.appSettings)
    await expect(page.getByTestId('merchant-settings-screen')).toBeVisible()

    const merchantRestaurants = await getApiJson<MerchantRestaurantSummary[]>(page, '/restaurants')
    const selectedRestaurantId = await page
      .getByRole('combobox', { name: /Nhà hàng|Restaurant|店舗/i })
      .inputValue()
    const targetRestaurant =
      merchantRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
      merchantRestaurants[0]

    expect(targetRestaurant).toBeTruthy()

    const beforeDetail = await getApiJson<MerchantRestaurantDetail>(
      page,
      `/restaurants/${targetRestaurant.id}`,
    )

    await page.getByTestId('merchant-google-maps-input').fill(GOOGLE_MAPS_SHORT_URL)
    await page.getByTestId('save-source').click()
    await expect(page.getByTestId('merchant-source-status-badge')).toContainText(
      /Google Maps URL|URL Google Maps/i,
    )
    await expect(page.getByTestId('merchant-source-hint')).toContainText(/admin/i)

    const afterSaveDetail = await pollUntil(
      page,
      () =>
        getApiJson<MerchantRestaurantDetail>(page, `/restaurants/${targetRestaurant.id}`),
      (detail) => detail.googleMapUrl === GOOGLE_MAPS_SHORT_URL,
      'Merchant source URL was not persisted to the restaurant profile',
    )

    const beforePublishedAt = beforeDetail.datasetStatus.lastPublishedAt
    expect(afterSaveDetail.googleMapUrl).toBe(GOOGLE_MAPS_SHORT_URL)

    await logout(page)

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')
    await goToRoute(page, HASH_ROUTES.adminRestaurants)
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await page.getByRole('button', { name: new RegExp(targetRestaurant.name, 'i') }).first().click()

    const beforeSourceResponse = await getApiJson<ReviewOpsSourcesResponse>(
      page,
      `/admin/review-ops/sources?restaurantId=${targetRestaurant.id}`,
    )
    const previousSource = beforeSourceResponse.sources.find(
      (source) => source.inputUrl === GOOGLE_MAPS_SHORT_URL,
    )
    const actionStartedAt = Date.now()

    await goToRoute(page, HASH_ROUTES.adminReviewOps)
    await expect(page.getByTestId('admin-review-ops')).toBeVisible()
    await expect(page.getByTestId('review-ops-sync-url-input')).toHaveValue(GOOGLE_MAPS_SHORT_URL)

    await page.getByTestId('review-ops-sync-button').click()

    const sourceAfterSync = await pollUntil(
      page,
      () =>
        getApiJson<ReviewOpsSourcesResponse>(
          page,
          `/admin/review-ops/sources?restaurantId=${targetRestaurant.id}`,
        ).then(
          (response) =>
            response.sources.find((source) => source.inputUrl === GOOGLE_MAPS_SHORT_URL) ?? null,
        ),
      (source) =>
        Boolean(
          source?.latestRun &&
            Date.parse(source.latestRun.updatedAt) >= actionStartedAt - 1_000 &&
            (
              source.latestRun.id !== previousSource?.latestRun?.id ||
              Date.parse(source.latestRun.updatedAt) >
                Date.parse(previousSource?.latestRun?.updatedAt ?? '1970-01-01T00:00:00.000Z')
            ),
        ),
      'Admin sync did not create a fresh review-ops run for the saved Google Maps URL',
    )

    const runDetail = await pollUntil(
      page,
      () => getApiJson<ReviewOpsRunDetailResponse>(page, `/admin/review-ops/runs/${sourceAfterSync.latestRun?.id}`),
      (detail) =>
        ['PARTIAL', 'COMPLETED'].includes(detail.run.status) && Boolean(detail.run.intakeBatchId),
      'The synced run never materialized into a draft intake batch',
    )

    const batchId = runDetail.run.intakeBatchId as string

    await pollUntil(
      page,
      () =>
        getApiJson<ReviewOpsBatchReadiness>(
          page,
          `/admin/review-ops/batches/${batchId}/readiness`,
        ),
      (readiness) => readiness.bulkApprovableCount > 0,
      'The synced draft never became bulk-approvable',
    )

    await pollUntil(
      page,
      async () => {
        const refreshButton = page.getByTestId('review-ops-refresh-run-button')
        if (await refreshButton.count()) {
          await refreshButton.click()
        }

        const approveButton = page.getByTestId('review-ops-approve-valid-button')
        if (!(await approveButton.count())) {
          return false
        }

        return await approveButton.isEnabled()
      },
      (enabled) => enabled,
      'The approve-valid action never became available in the review-ops UI',
    )

    await expect(page.getByTestId('review-ops-approve-valid-button')).toBeEnabled()
    await page.getByTestId('review-ops-approve-valid-button').click()

    await pollUntil(
      page,
      () =>
        getApiJson<ReviewOpsBatchReadiness>(
          page,
          `/admin/review-ops/batches/${batchId}/readiness`,
        ),
      (readiness) => readiness.counts.approvedItems > 0 && readiness.publishAllowed,
      'The synced draft never became publishable after bulk approval',
    )

    await expect(page.getByTestId('review-ops-publish-button')).toBeEnabled()
    await page.getByTestId('review-ops-publish-button').click()

    await logout(page)

    await loginAs(page, SEED_CREDENTIALS.userPrimary, 'USER')

    const afterPublishDetail = await pollUntil(
      page,
      () =>
        getApiJson<MerchantRestaurantDetail>(page, `/restaurants/${targetRestaurant.id}`),
      (detail) =>
        detail.datasetStatus.lastPublishedAt !== beforePublishedAt &&
        detail.insightSummary.totalReviews > 0,
      'Merchant-visible dataset did not refresh after admin publish',
    )

    await goToRoute(page, HASH_ROUTES.appHome)
    await expect(page.getByTestId('merchant-home-screen')).toBeVisible()
    await expect(page.getByTestId('merchant-home-freshness-pill')).toContainText(
      /Published|Đã cập nhật/i,
    )
    await expect(page.getByTestId('merchant-home-source-pill')).toContainText(
      /Google Maps URL|URL Google Maps/i,
    )
    expect(afterPublishDetail.datasetStatus.lastPublishedAt).not.toBe(beforePublishedAt)
    expect(afterPublishDetail.insightSummary.totalReviews).toBeGreaterThan(0)
    expect(afterPublishDetail.datasetStatus.approvedItemCount).toBeGreaterThanOrEqual(0)

    await logout(page)
  })
})
