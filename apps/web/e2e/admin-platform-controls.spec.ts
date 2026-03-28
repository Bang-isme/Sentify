import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS, SEED_RESTAURANTS } from './support/test-data'
import { goToRoute, loginAs, logout } from './support/session'

const GOOGLE_MAPS_SHORT_URL = 'https://maps.app.goo.gl/yWeP9xmjowpkYVbU7'

interface AdminRestaurantSummary {
  id: string
  name: string
}

interface AdminIntegrationsPoliciesResponse {
  policies: {
    runtimeControls: {
      crawlQueueWritesEnabled: boolean
      crawlMaterializationEnabled: boolean
      intakePublishEnabled: boolean
      note: string | null
    }
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
  batch: {
    id: string
    status: string
  }
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

async function patchApiJson<T>(page: Page, path: string, body: unknown): Promise<T> {
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
  const response = await page.context().request.patch(`${LOCAL_URLS.apiBaseUrl}${path}`, {
    data: body,
    headers: csrfToken
      ? {
          'X-CSRF-Token': csrfToken,
        }
      : undefined,
  })

  expect(response.ok(), `Expected PATCH ${path} to return 2xx`).toBeTruthy()

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

test.describe('ADMIN platform controls', () => {
  test('platform publish control blocks review-ops publish from the browser flow', async ({ page }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')

    const controlsBefore = await getApiJson<AdminIntegrationsPoliciesResponse>(
      page,
      '/admin/platform/integrations-policies',
    )
    const originalControls = controlsBefore.policies.runtimeControls
    const maintenanceNote = `playwright-publish-pause-${Date.now()}`

    try {
      await goToRoute(page, HASH_ROUTES.adminIntegrationsPolicies)
      await expect(page.getByTestId('admin-integrations-policies-screen')).toBeVisible()

      if (originalControls.intakePublishEnabled) {
        await page.getByTestId('admin-platform-toggle-publish').uncheck()
      }
      await page.getByTestId('admin-platform-note-input').fill(maintenanceNote)
      await page.getByTestId('admin-platform-save-controls').click()

      await pollUntil(
        page,
        () =>
          getApiJson<AdminIntegrationsPoliciesResponse>(
            page,
            '/admin/platform/integrations-policies',
          ),
        (response) =>
          response.policies.runtimeControls.intakePublishEnabled === false &&
          response.policies.runtimeControls.note === maintenanceNote,
        'Platform publish control did not persist from the browser UI',
      )

      const adminRestaurants = await getApiJson<AdminRestaurantSummary[]>(page, '/admin/restaurants')
      const targetRestaurant = adminRestaurants.find((restaurant) =>
        restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.tacombi.toLowerCase()),
      )

      expect(targetRestaurant).toBeTruthy()

      await goToRoute(page, HASH_ROUTES.adminRestaurants)
      await expect(page.getByTestId('admin-overview')).toBeVisible()
      await page
        .getByRole('button', { name: new RegExp(SEED_RESTAURANTS.tacombi, 'i') })
        .first()
        .click()

      const beforeSourceResponse = await getApiJson<ReviewOpsSourcesResponse>(
        page,
        `/admin/review-ops/sources?restaurantId=${targetRestaurant?.id}`,
      )
      const previousSource = beforeSourceResponse.sources.find(
        (source) => source.inputUrl === GOOGLE_MAPS_SHORT_URL,
      )
      const actionStartedAt = Date.now()

      await goToRoute(page, HASH_ROUTES.adminReviewOps)
      await expect(page.getByTestId('admin-review-ops')).toBeVisible()
      await page.getByTestId('review-ops-sync-url-input').fill(GOOGLE_MAPS_SHORT_URL)
      await page.getByTestId('review-ops-sync-button').click()

      const sourceAfterSync = await pollUntil(
        page,
        () =>
          getApiJson<ReviewOpsSourcesResponse>(
            page,
            `/admin/review-ops/sources?restaurantId=${targetRestaurant?.id}`,
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
        'Admin sync did not create a fresh run while publish was paused',
      )

      const runDetail = await pollUntil(
        page,
        () =>
          getApiJson<ReviewOpsRunDetailResponse>(
            page,
            `/admin/review-ops/runs/${sourceAfterSync.latestRun?.id}`,
          ),
        (detail) =>
          ['PARTIAL', 'COMPLETED'].includes(detail.run.status) && Boolean(detail.run.intakeBatchId),
        'The paused-publish run never materialized into a draft batch',
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
        'The draft batch never became approvable',
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
        'The approve-valid action never became available',
      )

      await page.getByTestId('review-ops-approve-valid-button').click()

      await pollUntil(
        page,
        () =>
          getApiJson<ReviewOpsBatchReadiness>(
            page,
            `/admin/review-ops/batches/${batchId}/readiness`,
          ),
        (readiness) => readiness.counts.approvedItems > 0,
        'The draft batch never recorded approved items',
      )

      await expect(page.getByTestId('review-ops-publish-button')).toBeEnabled()
      await page.getByTestId('review-ops-publish-button').click()

      await expect(
        page.getByText(/platform controls|publish is currently disabled/i).first(),
      ).toBeVisible()

      const readinessAfterFailure = await getApiJson<ReviewOpsBatchReadiness>(
        page,
        `/admin/review-ops/batches/${batchId}/readiness`,
      )
      expect(readinessAfterFailure.batch.status).not.toBe('PUBLISHED')
      expect(readinessAfterFailure.counts.approvedItems).toBeGreaterThan(0)
    } finally {
      const restoreBody: {
        crawlQueueWritesEnabled: boolean
        crawlMaterializationEnabled: boolean
        intakePublishEnabled: boolean
        note?: string
      } = {
        crawlQueueWritesEnabled: originalControls.crawlQueueWritesEnabled,
        crawlMaterializationEnabled: originalControls.crawlMaterializationEnabled,
        intakePublishEnabled: originalControls.intakePublishEnabled,
      }

      if (typeof originalControls.note === 'string') {
        restoreBody.note = originalControls.note
      }

      await patchApiJson(page, '/admin/platform/controls', restoreBody)
      await logout(page)
    }
  })
})
