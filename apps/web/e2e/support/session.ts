import { expect, type Page } from '@playwright/test'
import { HASH_ROUTES, SEED_CREDENTIALS, type SeedAccount, type SeedRole } from './test-data'

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function navButtonPattern(label: string) {
  return new RegExp(escapeRegex(label), 'i')
}

function shellNavPattern(step: number, label: string) {
  return new RegExp(`Step ${step} ${escapeRegex(label)}`, 'i')
}

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
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(SEED_CREDENTIALS.password)
  await page.locator('#main-content').getByRole('button', { name: 'Login', exact: true }).click()

  if (expectedRole === 'ADMIN') {
    await expect(page.getByRole('button', { name: shellNavPattern(1, 'Restaurants') }).first()).toBeVisible()
    return
  }

  await expect(page.getByRole('button', { name: shellNavPattern(1, 'Dashboard') }).first()).toBeVisible()
}

export async function expectMerchantShell(page: Page) {
  await expect(page.getByRole('button', { name: shellNavPattern(1, 'Dashboard') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(2, 'Reviews') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(3, 'Settings') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(1, 'Intake') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: shellNavPattern(2, 'Review ops') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: shellNavPattern(3, 'Crawl runtime') })).toHaveCount(0)
}

export async function expectAdminShell(page: Page) {
  await expect(page.getByRole('button', { name: shellNavPattern(1, 'Restaurants') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(2, 'Intake') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(3, 'Review ops') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(4, 'Crawl runtime') }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: shellNavPattern(1, 'Dashboard') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: shellNavPattern(2, 'Reviews') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: shellNavPattern(3, 'Settings') })).toHaveCount(0)
}

export async function selectRestaurant(page: Page, currentRestaurantName: string, targetRestaurantName: string) {
  if (currentRestaurantName === targetRestaurantName) {
    return
  }

  const switcherButton = page
    .getByRole('button', { name: new RegExp(escapeRegex(currentRestaurantName), 'i') })
    .first()

  if ((await switcherButton.count()) === 0) {
    return
  }

  await switcherButton.click()
  await expect(page.getByRole('listbox', { name: 'Restaurant' })).toBeVisible()
  await page.getByRole('option', { name: targetRestaurantName, exact: true }).click()
  await expect(
    page.getByRole('button', { name: new RegExp(escapeRegex(targetRestaurantName), 'i') }).first(),
  ).toBeVisible()
}

export async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Open account menu' })).toBeVisible()
}

export async function logout(page: Page) {
  await openAccountMenu(page)
  await page.getByRole('menuitem', { name: 'Logout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Login', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start free', exact: true }).first()).toBeVisible()
}

export async function assertRouteBlockedForUser(page: Page) {
  await expect(page).not.toHaveURL(/#\/admin\/(?:intake|review-ops|review-crawl)/)
  await expectMerchantShell(page)
}

export async function assertRouteBlockedForAdmin(page: Page) {
  await expect(page).not.toHaveURL(/#\/app(?:\/|$)/)
  await expectAdminShell(page)
}

export async function goToRoute(page: Page, route: string) {
  const previousHash = await page.evaluate(() => window.location.hash)
  await page.evaluate((nextRoute) => {
    window.location.hash = nextRoute
  }, route)
  await page.waitForFunction((beforeHash) => window.location.hash !== beforeHash, previousHash)
}
