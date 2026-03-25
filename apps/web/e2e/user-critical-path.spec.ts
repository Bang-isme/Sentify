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

    await page.getByTestId('nav-app').click()
    await expect(page.getByTestId('merchant-home-screen')).toBeVisible()

    await page.getByTestId('nav-app-reviews').click()
    await expect(page.getByTestId('merchant-reviews-screen')).toBeVisible()

    await page.getByTestId('nav-app-actions').click()
    await expect(page.getByTestId('merchant-actions-screen')).toBeVisible()

    await page.getByTestId('nav-app-settings').click()
    await expect(page.getByTestId('merchant-settings-screen')).toBeVisible()
    await expect(page.getByTestId('settings-form')).toBeVisible()

    const restaurantName = page.getByTestId('restaurant-name-input')
    const restaurantAddress = page.getByTestId('restaurant-address-input')
    const originalName = await restaurantName.inputValue()
    const originalAddress = await restaurantAddress.inputValue()
    const temporaryName = `${originalName} - Playwright`
    const temporaryAddress = `${originalAddress} Suite QA`

    await restaurantName.fill(temporaryName)
    await restaurantAddress.fill(temporaryAddress)
    await page.getByTestId('save-profile').click()
    await expect(page.getByRole('status').first()).toBeVisible()

    await restaurantName.fill(originalName)
    await restaurantAddress.fill(originalAddress)
    await page.getByTestId('save-profile').click()
    await expect(page.getByRole('status').first()).toBeVisible()

    await goToRoute(page, HASH_ROUTES.adminIntake)
    await assertRouteBlockedForUser(page)

    await logout(page)
  })
})
