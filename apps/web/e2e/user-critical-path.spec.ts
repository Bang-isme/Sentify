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

  await page.getByRole('button', { name: /Step 1 Dashboard/i }).first().click()
  await expect(page.getByRole('button', { name: /Step 1 Dashboard/i }).first()).toBeVisible()

  await page.getByRole('button', { name: /Step 2 Reviews/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Review evidence' }).first()).toBeVisible()

  await page.getByRole('button', { name: /Step 3 Settings/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Restaurant settings' }).first()).toBeVisible()

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

    await expect(page.getByRole('button', { name: /Step 1 Intake/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Step 2 Review ops/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Step 3 Crawl runtime/i })).toHaveCount(0)

    await goToRoute(page, HASH_ROUTES.adminIntake)
    await assertRouteBlockedForUser(page)

    await logout(page)
  })
})
