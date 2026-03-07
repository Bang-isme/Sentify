import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import {
  ApiClientError,
  createRestaurant,
  getComplaintKeywords,
  getDashboardKpi,
  getSession,
  getRestaurantDetail,
  getSentimentBreakdown,
  getTrend,
  importReviews,
  listRestaurants,
  listReviewEvidence,
  login,
  logout,
  register,
  updateRestaurant,
  type AuthUser,
  type ComplaintKeyword,
  type InsightSummary,
  type RestaurantDetail,
  type RestaurantMembership,
  type ReviewListResponse,
  type SentimentBreakdownRow,
  type TrendPoint,
} from '../src/lib/api'

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api')

  return {
    ...actual,
    createRestaurant: vi.fn(),
    getComplaintKeywords: vi.fn(),
    getDashboardKpi: vi.fn(),
    getSession: vi.fn(),
    getRestaurantDetail: vi.fn(),
    getSentimentBreakdown: vi.fn(),
    getTrend: vi.fn(),
    importReviews: vi.fn(),
    listRestaurants: vi.fn(),
    listReviewEvidence: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    updateRestaurant: vi.fn(),
  }
})

const listRestaurantsMock = vi.mocked(listRestaurants)
const getRestaurantDetailMock = vi.mocked(getRestaurantDetail)
const getDashboardKpiMock = vi.mocked(getDashboardKpi)
const getSessionMock = vi.mocked(getSession)
const getSentimentBreakdownMock = vi.mocked(getSentimentBreakdown)
const getTrendMock = vi.mocked(getTrend)
const getComplaintKeywordsMock = vi.mocked(getComplaintKeywords)
const listReviewEvidenceMock = vi.mocked(listReviewEvidence)
const loginMock = vi.mocked(login)
const logoutMock = vi.mocked(logout)
const registerMock = vi.mocked(register)
const createRestaurantMock = vi.mocked(createRestaurant)
const updateRestaurantMock = vi.mocked(updateRestaurant)
const importReviewsMock = vi.mocked(importReviews)

function createMembership(overrides: Partial<RestaurantMembership> = {}): RestaurantMembership {
  return {
    id: overrides.id ?? 'rest-1',
    name: overrides.name ?? 'Cafe Aurora',
    slug: overrides.slug ?? 'cafe-aurora',
    permission: overrides.permission ?? 'OWNER',
    googleMapUrl: overrides.googleMapUrl ?? 'https://maps.google.com/cafe-aurora',
    totalReviews: overrides.totalReviews ?? 12,
  }
}

function createDetail(
  membership: RestaurantMembership,
  overrides: Partial<RestaurantDetail> = {},
): RestaurantDetail {
  return {
    id: membership.id,
    name: overrides.name ?? membership.name,
    slug: overrides.slug ?? membership.slug,
    address: overrides.address ?? '123 Market Street',
    googleMapUrl:
      overrides.googleMapUrl === undefined ? membership.googleMapUrl ?? null : overrides.googleMapUrl,
    permission: overrides.permission ?? membership.permission,
    insightSummary: overrides.insightSummary ?? {
      totalReviews: 24,
      averageRating: 4.2,
      positivePercentage: 54,
      neutralPercentage: 15,
      negativePercentage: 31,
    },
  }
}

function createReviewsResponse(overrides: Partial<ReviewListResponse> = {}): ReviewListResponse {
  return {
    data: overrides.data ?? [],
    pagination: overrides.pagination ?? {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    },
  }
}

function mockAuthenticatedSession({
  restaurants = [],
  user,
}: {
  restaurants?: RestaurantMembership[]
  user?: Partial<AuthUser>
} = {}) {
  getSessionMock.mockResolvedValue({
    user: {
      id: 'user-1',
      email: user?.email ?? 'owner@sentify.test',
      fullName: user?.fullName ?? 'Casey Owner',
      restaurants,
    },
  })
}

beforeEach(() => {
  const membership = createMembership()
  const detail = createDetail(membership)
  const kpi: InsightSummary = detail.insightSummary
  const sentiment: SentimentBreakdownRow[] = [
    { label: 'POSITIVE', count: 10, percentage: 50 },
    { label: 'NEUTRAL', count: 4, percentage: 20 },
    { label: 'NEGATIVE', count: 6, percentage: 30 },
  ]
  const trend: TrendPoint[] = [
    { label: 'Week 1', averageRating: 4.1, reviewCount: 8 },
    { label: 'Week 2', averageRating: 4.3, reviewCount: 10 },
  ]
  const complaints: ComplaintKeyword[] = [{ keyword: 'Wait time', count: 5, percentage: 25 }]

  getSessionMock.mockRejectedValue(
    new ApiClientError(401, {
      code: 'AUTH_MISSING_TOKEN',
      message: 'Access token is required',
    }),
  )
  listRestaurantsMock.mockResolvedValue([membership])
  getRestaurantDetailMock.mockResolvedValue(detail)
  getDashboardKpiMock.mockResolvedValue(kpi)
  getSentimentBreakdownMock.mockResolvedValue(sentiment)
  getTrendMock.mockResolvedValue(trend)
  getComplaintKeywordsMock.mockResolvedValue(complaints)
  listReviewEvidenceMock.mockResolvedValue(createReviewsResponse())
  loginMock.mockResolvedValue({
    expiresIn: 3600,
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
      restaurants: [membership],
    },
  })
  logoutMock.mockResolvedValue({ message: 'ok' })
  registerMock.mockResolvedValue({
    expiresIn: 3600,
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
      restaurants: [],
    },
  })
  createRestaurantMock.mockResolvedValue(membership)
  updateRestaurantMock.mockResolvedValue(detail)
  importReviewsMock.mockResolvedValue({
    imported: 10,
    skipped: 0,
    total: 10,
    message: 'done',
  })
})

describe('Sentify app shell', () => {
  it('guards guest users away from app routes', async () => {
    window.location.hash = '#/app'

    render(<App />)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/login')
    })
    expect(screen.getAllByRole('button', { name: /login/i }).length).toBeGreaterThan(0)
  })

  it('routes the hero dashboard CTA through auth for guest users', async () => {
    window.location.hash = '#/'
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Go to dashboard' }))

    await waitFor(() => {
      expect(window.location.hash).toBe('#/login')
    })
  })

  it('shows onboarding instead of the sidebar when no restaurants exist', async () => {
    mockAuthenticatedSession({ restaurants: [] })
    listRestaurantsMock.mockResolvedValue([])
    window.location.hash = '#/app'

    render(<App />)

    expect(await screen.findByText('Connect your first restaurant')).toBeInTheDocument()
    expect(screen.queryByText('Current restaurant')).not.toBeInTheDocument()
  })

  it('renders the authenticated header with avatar menu and closes it on Escape', async () => {
    mockAuthenticatedSession({ restaurants: [createMembership()] })
    window.location.hash = '#/app'
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('Operational triage dashboard')).toBeInTheDocument()

    const accountButton = screen.getByRole('button', { name: /open account menu/i })
    expect(accountButton).toHaveTextContent('Casey Owner')
    expect(accountButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(accountButton)
    expect(accountButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('owner@sentify.test')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(accountButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  it('switches language cleanly across English, Vietnamese, and Japanese', async () => {
    mockAuthenticatedSession({ restaurants: [createMembership()] })
    window.location.hash = '#/app'
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('Operational triage dashboard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /switch language/i }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Tiếng Việt' }))
    expect(await screen.findByText('Bảng điều hành ưu tiên vận hành')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('vi')

    await user.click(screen.getByRole('button', { name: /đổi ngôn ngữ/i }))
    await user.click(screen.getByRole('menuitemradio', { name: '日本語' }))
    expect(await screen.findByText('運営優先度ダッシュボード')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ja')
  })

  it('shows the add-another-restaurant flow inside settings instead of the sidebar', async () => {
    mockAuthenticatedSession({ restaurants: [createMembership()] })
    window.location.hash = '#/app/settings'

    render(<App />)

    expect(await screen.findByText('Restaurant settings')).toBeInTheDocument()
    expect(screen.getAllByText('Add another restaurant').length).toBeGreaterThan(0)
    expect(screen.queryByText('Restaurant setup')).not.toBeInTheDocument()
  })

  it('guides the user to settings when the selected restaurant is missing a source URL', async () => {
    const membership = createMembership({ googleMapUrl: null })
    mockAuthenticatedSession({ restaurants: [membership] })
    listRestaurantsMock.mockResolvedValue([membership])
    getRestaurantDetailMock.mockResolvedValue(createDetail(membership, { googleMapUrl: null }))
    window.location.hash = '#/app'

    render(<App />)

    expect(await screen.findByText('Add a source URL before running import.')).toBeInTheDocument()
    expect(screen.getAllByText('Open settings').length).toBeGreaterThan(0)
  })

  it('shows the localized empty state for review evidence', async () => {
    mockAuthenticatedSession({ restaurants: [createMembership()] })
    listReviewEvidenceMock.mockResolvedValue(
      createReviewsResponse({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      }),
    )
    window.location.hash = '#/app/reviews'

    render(<App />)

    expect((await screen.findAllByText('Review evidence')).length).toBeGreaterThan(0)
    expect(
      screen.getByText('No reviews imported yet. Save the source URL and run the first import.'),
    ).toBeInTheDocument()
  })

  it('blocks invalid signup input on the client before calling register', async () => {
    window.location.hash = '#/signup'
    const user = userEvent.setup()

    render(<App />)

    await user.type(await screen.findByLabelText('Full name'), '   ')
    await user.type(screen.getByLabelText('Email'), 'owner@sentify.test')
    await user.type(screen.getByLabelText('Password'), 'longenough')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(registerMock).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
  })

  it('blocks a non-Google source URL before creating a restaurant', async () => {
    mockAuthenticatedSession({ restaurants: [] })
    listRestaurantsMock.mockResolvedValue([])
    window.location.hash = '#/app'
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('Connect your first restaurant')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Restaurant name'), 'Cafe Aurora')
    await user.type(screen.getByLabelText('Google Maps URL'), 'https://example.com/place')
    await user.click(screen.getByRole('button', { name: 'Create restaurant' }))

    expect(createRestaurantMock).not.toHaveBeenCalled()
    expect(screen.getByText('Use a Google Maps URL.')).toBeInTheDocument()
  })

  it('blocks an invalid review date range before refetching review evidence', async () => {
    mockAuthenticatedSession({ restaurants: [createMembership()] })
    window.location.hash = '#/app/reviews'
    const user = userEvent.setup()

    render(<App />)

    expect((await screen.findAllByText('Review evidence')).length).toBeGreaterThan(0)

    listReviewEvidenceMock.mockClear()
    await user.type(screen.getByLabelText('From'), '2026-03-07')
    await user.type(screen.getByLabelText('To'), '2026-03-01')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(listReviewEvidenceMock).not.toHaveBeenCalled()
    expect(screen.getByText('`From` must be before or equal to `To`.')).toBeInTheDocument()
  })

  it('switches restaurant context through the custom switcher', async () => {
    const firstRestaurant = createMembership({ id: 'rest-1', name: 'Cafe Aurora' })
    const secondRestaurant = createMembership({
      id: 'rest-2',
      name: 'Bistro Nova',
      slug: 'bistro-nova',
      googleMapUrl: 'https://maps.google.com/bistro-nova',
    })

    mockAuthenticatedSession({
      restaurants: [firstRestaurant, secondRestaurant],
    })

    listRestaurantsMock.mockResolvedValue([firstRestaurant, secondRestaurant])
    getRestaurantDetailMock.mockImplementation(async (restaurantId) =>
      restaurantId === secondRestaurant.id ? createDetail(secondRestaurant) : createDetail(firstRestaurant),
    )

    window.location.hash = '#/app'
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('Operational triage dashboard')).toBeInTheDocument()

    const switcherButton = screen.getByRole('button', { name: /cafe aurora/i })
    await user.click(switcherButton)
    await user.click(screen.getByRole('option', { name: /bistro nova/i }))

    await waitFor(() => {
      expect(getRestaurantDetailMock).toHaveBeenLastCalledWith('rest-2')
    })
  })
})
