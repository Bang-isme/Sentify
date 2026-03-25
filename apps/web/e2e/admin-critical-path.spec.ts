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

    await expect(page.getByRole('heading', { name: 'One admin product, organized into operations, access, and platform.' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Restaurants/i }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Review ops$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Review operations' }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Crawl$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Crawl runtime controls' }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Intake$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Admin review intake' }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Users$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Access' }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Health & jobs$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Platform' }).first()).toBeVisible()

    await expect(page.getByRole('button', { name: /^Home$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Reviews$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Actions$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Settings$/i })).toHaveCount(0)

    await goToRoute(page, HASH_ROUTES.appHome)
    await assertRouteBlockedForAdmin(page)

    await logout(page)
  })
})
