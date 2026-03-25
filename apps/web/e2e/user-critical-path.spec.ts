import { expect, test } from '@playwright/test'
import { HASH_ROUTES, SEED_CREDENTIALS } from './support/test-data'
import {
  assertRouteBlockedForUser,
  expectMerchantShell,
  goToRoute,
  loginAs,
  logout,
} from './support/session'

test.describe('USER critical path', () => {
  test('can login, work in merchant shell, update settings, and stay out of admin routes', async ({
    page,
  }) => {
    await loginAs(page, SEED_CREDENTIALS.userPrimary, 'USER')
    await expectMerchantShell(page)

    await page.getByRole('button', { name: /^Home$/i }).first().click()
    await expect(page.getByText('Dataset freshness').first()).toBeVisible()

    await page.getByRole('button', { name: /^Reviews$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Evidence explorer' }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Actions$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'What to fix first' }).first()).toBeVisible()

    await page.getByRole('button', { name: /^Settings$/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Settings that stay readable' }).first()).toBeVisible()

    const restaurantName = page.getByLabel('Restaurant name')
    const restaurantAddress = page.getByLabel('Address')
    const originalName = await restaurantName.inputValue()
    const originalAddress = await restaurantAddress.inputValue()
    const temporaryName = `${originalName} - Playwright`
    const temporaryAddress = `${originalAddress} Suite QA`

    await restaurantName.fill(temporaryName)
    await restaurantAddress.fill(temporaryAddress)
    await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
    await expect(page.getByText('Changes saved.').first()).toBeVisible()

    await restaurantName.fill(originalName)
    await restaurantAddress.fill(originalAddress)
    await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
    await expect(page.getByText('Changes saved.').first()).toBeVisible()

    await expect(page.getByRole('button', { name: /^Restaurants$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Intake$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Review ops$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Crawl$/i })).toHaveCount(0)

    await goToRoute(page, HASH_ROUTES.adminIntake)
    await assertRouteBlockedForUser(page)

    await logout(page)
  })
})
