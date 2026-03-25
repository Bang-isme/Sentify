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

    await expect(page.getByRole('heading', { name: 'Restaurants overview' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Step 1 Restaurants/i }).first()).toBeVisible()

    await page.getByRole('button', { name: /Step 3 Review ops/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Review operations' }).first()).toBeVisible()

    await page.getByRole('button', { name: /Step 4 Crawl runtime/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Crawl runtime controls' }).first()).toBeVisible()

    await page.getByRole('button', { name: /Step 2 Intake/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Admin review intake' }).first()).toBeVisible()

    await expect(page.getByRole('button', { name: /Step 1 Dashboard/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Step 2 Reviews/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Step 3 Settings/i })).toHaveCount(0)

    await goToRoute(page, HASH_ROUTES.appHome)
    await assertRouteBlockedForAdmin(page)

    await logout(page)
  })
})
