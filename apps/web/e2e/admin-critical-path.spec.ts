import { expect, test } from '@playwright/test'
import { HASH_ROUTES, SEED_CREDENTIALS } from './support/test-data'
import {
  assertRouteBlockedForAdmin,
  expectAdminShell,
  goToRoute,
  loginAs,
  logout,
} from './support/session'

test.describe('ADMIN critical path', () => {
  test('can login, inspect control plane, and stay out of merchant routes', async ({ page }) => {
    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')
    await expectAdminShell(page)

    await expect(page.getByTestId('admin-home-screen')).toBeVisible()

    await page.getByTestId('nav-admin-operations-restaurants').click()
    await expect(page.getByTestId('admin-overview')).toBeVisible()

    await page.getByTestId('nav-admin-operations-review-ops').click()
    await expect(page.getByTestId('admin-review-ops')).toBeVisible()

    await page.getByTestId('nav-admin-operations-crawl').click()
    await expect(page.getByTestId('admin-crawl')).toBeVisible()

    await page.getByTestId('nav-admin-operations-intake').click()
    await expect(page.getByTestId('admin-intake')).toBeVisible()

    await page.getByTestId('nav-admin-access-users').click()
    await expect(page.getByTestId('admin-users-screen')).toBeVisible()

    await page.getByTestId('nav-admin-access-memberships').click()
    await expect(page.getByTestId('admin-memberships-screen')).toBeVisible()

    await page.getByTestId('nav-admin-platform-health-jobs').click()
    await expect(page.getByTestId('admin-health-jobs-screen')).toBeVisible()

    await page.getByTestId('nav-admin-platform-integrations-policies').click()
    await expect(page.getByTestId('admin-integrations-policies-screen')).toBeVisible()

    await page.getByTestId('nav-admin-platform-audit').click()
    await expect(page.getByTestId('admin-audit-screen')).toBeVisible()

    await goToRoute(page, HASH_ROUTES.appHome)
    await assertRouteBlockedForAdmin(page)

    await logout(page)
  })
})
