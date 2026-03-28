import { expect, test, type Page } from '@playwright/test'
import { HASH_ROUTES, LOCAL_URLS, SEED_CREDENTIALS, SEED_RESTAURANTS } from './support/test-data'
import { goToRoute, loginAs, logout } from './support/session'

const OUTSIDER_ACCOUNT = {
  email: 'demo.outsider@sentify.local',
  fullName: 'Sentify Demo Outsider',
  role: 'USER' as const,
}

interface MerchantRestaurantSummary {
  id: string
  name: string
}

interface AdminMembershipGraphResponse {
  users: Array<{
    id: string
    email: string
    fullName: string
  }>
  restaurants: Array<{
    id: string
    name: string
  }>
  memberships: Array<{
    id: string
    user: {
      id: string
      email: string
      fullName: string
    }
    restaurant: {
      id: string
      name: string
    }
  }>
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

test.describe('ADMIN membership visibility', () => {
  test('admin membership changes the merchant scope end-to-end', async ({ page }) => {
    test.slow()

    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())

    await loginAs(page, OUTSIDER_ACCOUNT, 'USER')
    expect(await getApiJson<MerchantRestaurantSummary[]>(page, '/restaurants')).toEqual([])
    await expect(page.getByTestId('merchant-onboarding-panel')).toBeVisible()
    await logout(page)

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')
    await goToRoute(page, HASH_ROUTES.adminMemberships)
    await expect(page.getByTestId('admin-memberships-screen')).toBeVisible()

    const graph = await getApiJson<AdminMembershipGraphResponse>(page, '/admin/memberships')
    const outsiderUser = graph.users.find((user) => user.email === OUTSIDER_ACCOUNT.email)
    const targetRestaurant = graph.restaurants.find((restaurant) =>
      restaurant.name.toLowerCase().includes(SEED_RESTAURANTS.tacombi.toLowerCase()),
    )

    expect(outsiderUser).toBeTruthy()
    expect(targetRestaurant).toBeTruthy()
    expect(
      graph.memberships.some(
        (membership) =>
          membership.user.id === outsiderUser?.id &&
          membership.restaurant.id === targetRestaurant?.id,
      ),
    ).toBeFalsy()

    await page.getByTestId('admin-membership-user-select').selectOption(outsiderUser?.id as string)
    await page
      .getByTestId('admin-membership-restaurant-select')
      .selectOption(targetRestaurant?.id as string)
    await page.getByTestId('admin-membership-add-button').click()

    const createdMembership = await pollUntil(
      page,
      () =>
        getApiJson<AdminMembershipGraphResponse>(
          page,
          `/admin/memberships?userId=${outsiderUser?.id}&restaurantId=${targetRestaurant?.id}`,
        ).then(
          (response) =>
            response.memberships.find(
              (membership) =>
                membership.user.id === outsiderUser?.id &&
                membership.restaurant.id === targetRestaurant?.id,
            ) ?? null,
        ),
      (membership) => Boolean(membership),
      'Admin membership creation did not persist',
    )

    await expect(page.getByTestId(`admin-membership-row-${createdMembership.id}`)).toBeVisible()
    await logout(page)

    await loginAs(page, OUTSIDER_ACCOUNT, 'USER')
    const outsiderRestaurants = await getApiJson<MerchantRestaurantSummary[]>(page, '/restaurants')
    expect(outsiderRestaurants).toHaveLength(1)
    expect(outsiderRestaurants[0]).toMatchObject({
      id: targetRestaurant?.id as string,
      name: targetRestaurant?.name as string,
    })
    await expect(page.getByTestId('merchant-onboarding-panel')).toHaveCount(0)
    await expect(page.getByTestId('merchant-home-screen')).toBeVisible()
    await expect(page.getByText(new RegExp(targetRestaurant?.name as string, 'i')).first()).toBeVisible()
    await logout(page)

    await loginAs(page, SEED_CREDENTIALS.admin, 'ADMIN')
    await goToRoute(page, HASH_ROUTES.adminMemberships)
    await expect(page.getByTestId(`admin-membership-remove-${createdMembership.id}`)).toBeVisible()
    await page.getByTestId(`admin-membership-remove-${createdMembership.id}`).click()

    await pollUntil(
      page,
      () =>
        getApiJson<AdminMembershipGraphResponse>(
          page,
          `/admin/memberships?userId=${outsiderUser?.id}&restaurantId=${targetRestaurant?.id}`,
        ),
      (response) => response.memberships.length === 0,
      'Admin membership deletion did not persist',
    )
    await logout(page)

    await loginAs(page, OUTSIDER_ACCOUNT, 'USER')
    expect(await getApiJson<MerchantRestaurantSummary[]>(page, '/restaurants')).toEqual([])
    await expect(page.getByTestId('merchant-onboarding-panel')).toBeVisible()
    await logout(page)
  })
})
