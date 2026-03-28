import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS } from './support/test-data'
import { expectAdminShell, goToRoute, loginAs, logout } from './support/session'

interface AdminUserDetailResponse {
  user: {
    id: string
    role: 'USER' | 'ADMIN' | string
  }
  security: {
    pendingPasswordResetCount: number
  }
}

interface CreateAdminUserResponse {
  user: {
    id: string
    email: string
    fullName: string
    role: 'USER' | 'ADMIN' | string
  }
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

async function sendApiJson<T>(
  page: Page,
  method: 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
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
  const response = await page.context().request.fetch(`${LOCAL_URLS.apiBaseUrl}${path}`, {
    method,
    data: body,
    headers: csrfToken
      ? {
          'X-CSRF-Token': csrfToken,
        }
      : undefined,
  })

  expect(response.ok(), `Expected ${method} ${path} to return 2xx`).toBeTruthy()

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
  timeoutMs = 20_000,
  intervalMs = 500,
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

test.describe('ADMIN user lifecycle', () => {
  test('admin can reset a user password and promote the user to admin through the access UI', async ({
    page,
  }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')

    const tempUserEmail = `playwright.access.${Date.now()}@sentify.local`
    const tempUserName = 'Playwright Access Lifecycle'
    const createdUser = await sendApiJson<CreateAdminUserResponse>(page, 'POST', '/admin/users', {
      email: tempUserEmail,
      fullName: tempUserName,
      role: 'USER',
      password: SEED_CREDENTIALS.password,
    })

    const beforeDetail = await getApiJson<AdminUserDetailResponse>(
      page,
      `/admin/users/${createdUser.user.id}`,
    )

    await goToRoute(page, HASH_ROUTES.adminUsers)
    await expect(page.getByTestId('admin-users-screen')).toBeVisible()

    await pollUntil(
      page,
      async () => page.getByTestId(`admin-user-row-${createdUser.user.id}`).isVisible(),
      (isVisible) => isVisible,
      'The newly created user did not appear in the admin users directory',
    )

    await page.getByTestId(`admin-user-row-${createdUser.user.id}`).click()
    await expect(page.getByTestId('admin-user-password-reset-button')).toBeVisible()
    await page.getByTestId('admin-user-password-reset-button').click()

    await expect(page.getByTestId('admin-user-action-message')).toContainText(
      /reset link|password|mật khẩu/i,
    )

    const afterResetDetail = await pollUntil(
      page,
      () => getApiJson<AdminUserDetailResponse>(page, `/admin/users/${createdUser.user.id}`),
      (detail) =>
        detail.security.pendingPasswordResetCount > beforeDetail.security.pendingPasswordResetCount,
      'Password reset action did not increase the pending reset counter',
    )

    expect(afterResetDetail.user.role).toBe('USER')

    await page.getByTestId('admin-user-toggle-role-button').click()
    await expect(page.getByTestId('admin-user-action-message')).toContainText(/ADMIN/i)

    await pollUntil(
      page,
      () => getApiJson<AdminUserDetailResponse>(page, `/admin/users/${createdUser.user.id}`),
      (detail) => detail.user.role === 'ADMIN',
      'Role update did not persist to ADMIN',
    )

    await logout(page)

    await loginAs(
      page,
      {
        email: tempUserEmail,
        fullName: tempUserName,
        role: 'ADMIN',
      },
      'ADMIN',
    )
    await expectAdminShell(page)
    await expect(page.getByTestId('admin-home-screen')).toBeVisible()
    await logout(page)
  })
})
