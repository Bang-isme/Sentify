import { expect, type Page } from '@playwright/test'
import { HASH_ROUTES, SEED_CREDENTIALS, type SeedAccount, type SeedRole } from './test-data'

async function gotoHashRoute(page: Page, route: string) {
  await page.goto('/')
  await page.evaluate((nextRoute) => {
    window.location.hash = nextRoute
  }, route)
  await page.waitForFunction(
    (expectedRoute) => window.location.hash === `#${expectedRoute}`,
    route,
  )
}

export async function loginAs(page: Page, account: SeedAccount, expectedRole: SeedRole) {
  await gotoHashRoute(page, HASH_ROUTES.login)
  await expect(page.getByTestId('auth-shell')).toBeVisible()
  await page.getByTestId('auth-email').fill(account.email)
  await page.getByTestId('auth-password').fill(SEED_CREDENTIALS.password)
  await page.getByTestId('auth-submit').click()

  if (expectedRole === 'ADMIN') {
    await expect(page.getByTestId('admin-shell')).toBeVisible()
    await expect(page).toHaveURL(/#\/admin(?:\/|$)/)
    return
  }

  await expect(page.getByTestId('merchant-shell')).toBeVisible()
  await expect(page).toHaveURL(/#\/app(?:\/|$)/)
}

export async function expectMerchantShell(page: Page) {
  await expect(page.getByTestId('merchant-shell')).toBeVisible()
  await expect(page.getByTestId('merchant-nav')).toBeVisible()
  await expect(page.getByTestId('nav-app')).toBeVisible()
  await expect(page.getByTestId('nav-app-reviews')).toBeVisible()
  await expect(page.getByTestId('nav-app-actions')).toBeVisible()
  await expect(page.getByTestId('nav-app-settings')).toBeVisible()
  await expect(page.getByTestId('admin-nav')).toHaveCount(0)
}

export async function expectAdminShell(page: Page) {
  await expect(page.getByTestId('admin-shell')).toBeVisible()
  await expect(page.getByTestId('admin-nav')).toBeVisible()
  await expect(page.getByTestId('nav-admin-operations-restaurants')).toBeVisible()
  await expect(page.getByTestId('nav-admin-operations-intake')).toBeVisible()
  await expect(page.getByTestId('nav-admin-operations-review-ops')).toBeVisible()
  await expect(page.getByTestId('nav-admin-operations-crawl')).toBeVisible()
  await expect(page.getByTestId('nav-admin-access-users')).toBeVisible()
  await expect(page.getByTestId('nav-admin-access-memberships')).toBeVisible()
  await expect(page.getByTestId('nav-admin-platform-health-jobs')).toBeVisible()
  await expect(page.getByTestId('nav-admin-platform-integrations-policies')).toBeVisible()
  await expect(page.getByTestId('nav-admin-platform-audit')).toBeVisible()
  await expect(page.getByTestId('merchant-nav')).toHaveCount(0)
}

export async function openAccountMenu(page: Page) {
  await page.getByTestId('account-menu').click()
  await expect(page.getByRole('menu', { name: 'Mở menu tài khoản' })).toBeVisible()
  await expect(page.getByTestId('logout-action')).toBeVisible()
}

export async function logout(page: Page) {
  await openAccountMenu(page)
  await page.getByTestId('logout-action').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('merchant-shell')).toHaveCount(0)
  await expect(page.getByTestId('admin-shell')).toHaveCount(0)
  await expect(page.getByTestId('account-menu')).toHaveCount(0)
}

export async function assertRouteBlockedForUser(page: Page) {
  await expect(page).not.toHaveURL(/#\/admin(?:\/|$)/)
  await expectMerchantShell(page)
}

export async function assertRouteBlockedForAdmin(page: Page) {
  await expect(page).not.toHaveURL(/#\/app(?:\/|$)/)
  await expectAdminShell(page)
}

export async function goToRoute(page: Page, route: string) {
  await page.evaluate((nextRoute) => {
    window.location.hash = nextRoute
  }, route)
}
