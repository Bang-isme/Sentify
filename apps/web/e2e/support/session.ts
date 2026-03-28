import { expect, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS, type SeedAccount, type SeedRole } from './test-data'

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

async function waitForApi(page: Page, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  const apiOrigin = LOCAL_URLS.apiBaseUrl.replace(/\/api$/, '')
  let lastStatus: number | null = null

  while (Date.now() < deadline) {
    try {
      const response = await page.context().request.get(`${apiOrigin}/health`)

      if (response.ok()) {
        return
      }

      lastStatus = response.status()
    } catch {
      lastStatus = null
    }

    await page.waitForTimeout(500)
  }

  if (lastStatus) {
    throw new Error(`API health check did not become ready (last status ${lastStatus}).`)
  }

  throw new Error('API health check did not become ready.')
}

async function waitForLoginOutcome(page: Page, expectedRole: SeedRole, timeoutMs = 15_000) {
  const targetShell =
    expectedRole === 'ADMIN'
      ? page.getByTestId('admin-shell')
      : page.getByTestId('merchant-shell')
  const authError = page.getByTestId('auth-error-message')
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await targetShell.isVisible().catch(() => false)) {
      return { status: 'success' as const }
    }

    if (await authError.isVisible().catch(() => false)) {
      return {
        status: 'error' as const,
        message: (await authError.textContent())?.trim() ?? null,
      }
    }

    await page.waitForTimeout(250)
  }

  return { status: 'error' as const, message: null }
}

function isRetryableLoginError(message: string | null) {
  return Boolean(message && /failed to fetch|network|request failed/i.test(message))
}

export async function loginAs(page: Page, account: SeedAccount, expectedRole: SeedRole) {
  let lastError: Error | null = null

  await waitForApi(page)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await gotoHashRoute(page, HASH_ROUTES.login)
    await expect(page.getByTestId('auth-shell')).toBeVisible()
    await page.getByTestId('auth-email').fill(account.email)
    await page.getByTestId('auth-password').fill(SEED_CREDENTIALS.password)
    await page.getByTestId('auth-submit').click()

    const outcome = await waitForLoginOutcome(page, expectedRole)

    if (outcome.status === 'success') {
      if (expectedRole === 'ADMIN') {
        await expect(page).toHaveURL(/#\/admin(?:\/|$)/)
        return
      }

      await expect(page).toHaveURL(/#\/app(?:\/|$)/)
      return
    }

    if (isRetryableLoginError(outcome.message) && attempt === 0) {
      lastError = new Error(`Transient login failure for ${account.email}: ${outcome.message}`)
      await page.waitForTimeout(2_000)
      continue
    }

    if (outcome.message) {
      throw new Error(`Login failed for ${account.email}: ${outcome.message}`)
    }

    throw new Error(`Login did not reach the expected ${expectedRole} shell for ${account.email}.`)
  }

  throw lastError ?? new Error(`Login failed for ${account.email}.`)
}

export async function expectMerchantShell(page: Page) {
  await expect(page.getByTestId('merchant-shell')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('merchant-nav')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-app')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-app-reviews')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-app-actions')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-app-settings')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-nav')).toHaveCount(0)
}

export async function expectAdminShell(page: Page) {
  await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-nav')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-operations-restaurants')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-operations-intake')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-operations-review-ops')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-operations-crawl')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-access-users')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-access-memberships')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-platform-health-jobs')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('nav-admin-platform-integrations-policies')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByTestId('nav-admin-platform-audit')).toBeVisible({ timeout: 10_000 })
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
