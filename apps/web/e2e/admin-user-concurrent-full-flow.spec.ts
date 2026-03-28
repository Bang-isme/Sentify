import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS } from './support/test-data'
import {
  assertRouteBlockedForAdmin,
  assertRouteBlockedForUser,
  goToRoute,
  loginAs,
} from './support/session'

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

test.describe('ADMIN + USER concurrent full flow', () => {
  test('keeps both roles live in parallel while the review pipeline operationalizes a merchant source', async ({
    browser,
  }) => {
    test.slow()

    const userContext = await browser.newContext()
    const adminContext = await browser.newContext()
    const userPage = await userContext.newPage()
    const adminPage = await adminContext.newPage()

    try {
      await Promise.all([
        userPage.goto(LOCAL_URLS.webBaseUrl),
        adminPage.goto(LOCAL_URLS.webBaseUrl),
      ])
      await Promise.all([
        userPage.evaluate(() => window.localStorage.clear()),
        adminPage.evaluate(() => window.localStorage.clear()),
      ])
      await Promise.all([
        loginAs(userPage, SEED_CREDENTIALS.userPrimary, 'USER'),
        loginAs(adminPage, SEED_CREDENTIALS.admin, 'ADMIN'),
      ])

      await goToRoute(userPage, HASH_ROUTES.appSettings)
      await expect(userPage.getByTestId('merchant-settings-screen')).toBeVisible()

      const merchantRestaurants = await getApiJson<MerchantRestaurantSummary[]>(userPage, '/restaurants')
      const selectedRestaurantId = await userPage
        .getByRole('combobox', { name: /Nhà hàng|Restaurant|店铺/i })
        .inputValue()
      const targetRestaurant =
        merchantRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
        merchantRestaurants[0]

      expect(targetRestaurant).toBeTruthy()

      const beforeDetail = await getApiJson<MerchantRestaurantDetail>(
        userPage,
        `/restaurants/${targetRestaurant.id}`,
      )
      const beforePublishedAt = beforeDetail.datasetStatus.lastPublishedAt

      await userPage.getByTestId('merchant-google-maps-input').fill(GOOGLE_MAPS_SHORT_URL)
      await userPage.getByTestId('save-source').click()
      await expect(userPage.getByTestId('merchant-source-status-badge')).toContainText(
        /Google Maps URL|URL Google Maps/i,
      )

      await pollUntil(
        userPage,
        () => getApiJson<MerchantRestaurantDetail>(userPage, `/restaurants/${targetRestaurant.id}`),
        (detail) => detail.googleMapUrl === GOOGLE_MAPS_SHORT_URL,
        'Merchant source URL was not persisted before admin operations started',
      )

      const userGuardPage = await userContext.newPage()
      const adminGuardPage = await adminContext.newPage()

      try {
        await Promise.all([
          userGuardPage.goto(LOCAL_URLS.webBaseUrl),
          adminGuardPage.goto(LOCAL_URLS.webBaseUrl),
        ])
        await Promise.all([
          goToRoute(userGuardPage, HASH_ROUTES.adminReviewOps),
          goToRoute(adminGuardPage, HASH_ROUTES.appSettings),
        ])
        await Promise.all([
          assertRouteBlockedForUser(userGuardPage),
          assertRouteBlockedForAdmin(adminGuardPage),
        ])
      } finally {
        await Promise.allSettled([userGuardPage.close(), adminGuardPage.close()])
      }

      await goToRoute(adminPage, HASH_ROUTES.adminRestaurants)
      await expect(adminPage.getByTestId('admin-overview')).toBeVisible({ timeout: 10_000 })
      await adminPage
        .getByRole('button', { name: new RegExp(targetRestaurant.name, 'i') })
        .first()
        .click()

      const beforeSourceResponse = await getApiJson<ReviewOpsSourcesResponse>(
        adminPage,
        `/admin/review-ops/sources?restaurantId=${targetRestaurant.id}`,
      )
      const previousSource = beforeSourceResponse.sources.find(
        (source) => source.inputUrl === GOOGLE_MAPS_SHORT_URL,
      )
      const actionStartedAt = Date.now()

      await goToRoute(adminPage, HASH_ROUTES.adminReviewOps)
      await expect(adminPage.getByTestId('admin-review-ops')).toBeVisible()
      await expect(adminPage.getByTestId('review-ops-sync-url-input')).toHaveValue(
        GOOGLE_MAPS_SHORT_URL,
      )

      await adminPage.getByTestId('review-ops-sync-button').click()

      const sourceAfterSync = await pollUntil(
        adminPage,
        () =>
          getApiJson<ReviewOpsSourcesResponse>(
            adminPage,
            `/admin/review-ops/sources?restaurantId=${targetRestaurant.id}`,
          ).then(
            (response) =>
              response.sources.find((source) => source.inputUrl === GOOGLE_MAPS_SHORT_URL) ?? null,
          ),
        (source) =>
          Boolean(
            source?.latestRun &&
              Date.parse(source.latestRun.updatedAt) >= actionStartedAt - 1_000 &&
              (source.latestRun.id !== previousSource?.latestRun?.id ||
                Date.parse(source.latestRun.updatedAt) >
                  Date.parse(previousSource?.latestRun?.updatedAt ?? '1970-01-01T00:00:00.000Z')),
          ),
        'Admin sync did not create a fresh review-ops run for the saved Google Maps URL',
      )

      const runDetail = await pollUntil(
        adminPage,
        () =>
          getApiJson<ReviewOpsRunDetailResponse>(
            adminPage,
            `/admin/review-ops/runs/${sourceAfterSync.latestRun?.id}`,
          ).catch(() => null),
        (detail) =>
          Boolean(
            detail &&
              ['PARTIAL', 'COMPLETED'].includes(detail.run.status) &&
              detail.run.intakeBatchId,
          ),
        'The synced run never materialized into a draft intake batch',
      )

      const batchId = runDetail?.run.intakeBatchId as string

      await pollUntil(
        adminPage,
        () =>
          getApiJson<ReviewOpsBatchReadiness>(
            adminPage,
            `/admin/review-ops/batches/${batchId}/readiness`,
          ),
        (readiness) => readiness.bulkApprovableCount > 0,
        'The synced draft never became bulk-approvable',
      )

      await pollUntil(
        adminPage,
        async () => {
          const refreshButton = adminPage.getByTestId('review-ops-refresh-run-button')
          if (await refreshButton.count()) {
            await refreshButton.click()
          }

          const approveButton = adminPage.getByTestId('review-ops-approve-valid-button')
          if (!(await approveButton.count())) {
            return false
          }

          return approveButton.isEnabled()
        },
        (enabled) => enabled,
        'The approve-valid action never became available in the review-ops UI',
      )

      await expect(adminPage.getByTestId('review-ops-approve-valid-button')).toBeEnabled()
      await adminPage.getByTestId('review-ops-approve-valid-button').click()

      await pollUntil(
        adminPage,
        () =>
          getApiJson<ReviewOpsBatchReadiness>(
            adminPage,
            `/admin/review-ops/batches/${batchId}/readiness`,
          ),
        (readiness) => readiness.counts.approvedItems > 0 && readiness.publishAllowed,
        'The synced draft never became publishable after bulk approval',
      )

      await expect(adminPage.getByTestId('review-ops-publish-button')).toBeEnabled()
      await adminPage.getByTestId('review-ops-publish-button').click()

      const afterPublishDetail = await pollUntil(
        userPage,
        () => getApiJson<MerchantRestaurantDetail>(userPage, `/restaurants/${targetRestaurant.id}`),
        (detail) =>
          detail.datasetStatus.lastPublishedAt !== beforePublishedAt &&
          detail.insightSummary.totalReviews > 0,
        'Merchant-visible dataset did not refresh while the user session stayed live',
      )

      await goToRoute(userPage, HASH_ROUTES.appHome)
      await expect(userPage.getByTestId('merchant-home-screen')).toBeVisible()
      await expect(userPage.getByTestId('merchant-home-freshness-pill')).toContainText(
        /Published|Đã cập nhật/i,
      )
      await expect(userPage.getByTestId('merchant-home-source-pill')).toContainText(
        /Google Maps URL|URL Google Maps/i,
      )
      expect(afterPublishDetail.datasetStatus.lastPublishedAt).not.toBe(beforePublishedAt)
      expect(afterPublishDetail.insightSummary.totalReviews).toBeGreaterThan(0)
      expect(afterPublishDetail.datasetStatus.approvedItemCount).toBeGreaterThanOrEqual(0)
      await expect(adminPage.getByTestId('admin-review-ops')).toBeVisible()
    } finally {
      await Promise.allSettled([userContext.close(), adminContext.close()])
    }
  })
})
