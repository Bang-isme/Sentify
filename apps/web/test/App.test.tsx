import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import {
  ApiClientError,
  createRestaurant,
  getAdminRestaurantDetail,
  getComplaintKeywords,
  getDashboardKpi,
  getRestaurantDetail,
  getSentimentBreakdown,
  getSession,
  getTrend,
  listAdminRestaurants,
  listRestaurants,
  login,
  logout,
  register,
  updateRestaurant,
  type AdminRestaurantDetail,
  type AdminRestaurantSummary,
  type ComplaintKeyword,
  type InsightSummary,
  type RestaurantDetail,
  type RestaurantMembership,
  type SentimentBreakdownRow,
  type TrendPoint,
} from '../src/lib/api'

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api')

  return {
    ...actual,
    createRestaurant: vi.fn(),
    getAdminRestaurantDetail: vi.fn(),
    getComplaintKeywords: vi.fn(),
    getDashboardKpi: vi.fn(),
    getRestaurantDetail: vi.fn(),
    getSentimentBreakdown: vi.fn(),
    getSession: vi.fn(),
    getTrend: vi.fn(),
    listAdminRestaurants: vi.fn(),
    listRestaurants: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    updateRestaurant: vi.fn(),
  }
})

const getSessionMock = vi.mocked(getSession)
const listRestaurantsMock = vi.mocked(listRestaurants)
const getRestaurantDetailMock = vi.mocked(getRestaurantDetail)
const getDashboardKpiMock = vi.mocked(getDashboardKpi)
const getSentimentBreakdownMock = vi.mocked(getSentimentBreakdown)
const getTrendMock = vi.mocked(getTrend)
const getComplaintKeywordsMock = vi.mocked(getComplaintKeywords)
const listAdminRestaurantsMock = vi.mocked(listAdminRestaurants)
const getAdminRestaurantDetailMock = vi.mocked(getAdminRestaurantDetail)
const loginMock = vi.mocked(login)
const logoutMock = vi.mocked(logout)
const registerMock = vi.mocked(register)
const createRestaurantMock = vi.mocked(createRestaurant)
const updateRestaurantMock = vi.mocked(updateRestaurant)

function makeMembership(overrides: Partial<RestaurantMembership> = {}): RestaurantMembership {
  return {
    id: overrides.id ?? 'rest-1',
    name: overrides.name ?? 'Cafe Aurora',
    slug: overrides.slug ?? 'cafe-aurora',
    googleMapUrl: overrides.googleMapUrl ?? 'https://maps.google.com/cafe-aurora',
    totalReviews: overrides.totalReviews ?? 12,
  }
}

function makeDetail(
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
    datasetStatus: overrides.datasetStatus ?? {
      sourcePolicy: 'UNCONFIGURED',
      lastPublishedAt: null,
      lastPublishedSourceType: null,
      pendingBatchCount: 0,
      readyBatchCount: 0,
      pendingItemCount: 0,
      approvedItemCount: 0,
      rejectedItemCount: 0,
    },
    insightSummary: overrides.insightSummary ?? {
      totalReviews: 24,
      averageRating: 4.2,
      positivePercentage: 54,
      neutralPercentage: 15,
      negativePercentage: 31,
    },
  }
}

function makeAdminSummary(overrides: Partial<AdminRestaurantSummary> = {}): AdminRestaurantSummary {
  return {
    id: overrides.id ?? 'rest-1',
    name: overrides.name ?? 'Cafe Aurora',
    slug: overrides.slug ?? 'cafe-aurora',
    address: overrides.address ?? '123 Market Street',
    googleMapUrl: overrides.googleMapUrl ?? 'https://maps.google.com/cafe-aurora',
    totalReviews: overrides.totalReviews ?? 24,
    memberCount: overrides.memberCount ?? 2,
    pendingBatchCount: overrides.pendingBatchCount ?? 1,
    activeSourceCount: overrides.activeSourceCount ?? 1,
    insightSummary: overrides.insightSummary ?? {
      totalReviews: 24,
      averageRating: 4.2,
      positivePercentage: 54,
      neutralPercentage: 15,
      negativePercentage: 31,
    },
    createdAt: overrides.createdAt ?? '2026-03-25T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-25T00:00:00.000Z',
  }
}

function makeAdminDetail(
  summary: AdminRestaurantSummary,
  overrides: Partial<AdminRestaurantDetail> = {},
): AdminRestaurantDetail {
  return {
    restaurant: overrides.restaurant ?? {
      id: summary.id,
      name: summary.name,
      slug: summary.slug,
      address: summary.address,
      googleMapUrl: summary.googleMapUrl,
      totalReviews: summary.totalReviews,
      memberCount: summary.memberCount,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    },
    userFlow: overrides.userFlow ?? {
      datasetStatus: {
        sourcePolicy: 'ADMIN_CURATED',
        lastPublishedAt: '2026-03-25T00:00:00.000Z',
        lastPublishedSourceType: 'MANUAL',
        pendingBatchCount: 1,
        readyBatchCount: 0,
        pendingItemCount: 4,
        approvedItemCount: 12,
        rejectedItemCount: 1,
      },
      insightSummary: {
        totalReviews: 24,
        averageRating: 4.2,
        positivePercentage: 54,
        neutralPercentage: 15,
        negativePercentage: 31,
      },
    },
    adminFlow: overrides.adminFlow ?? {
      sourceStats: {
        totalCount: 1,
        activeCount: 1,
        disabledCount: 0,
      },
      latestRun: null,
      openBatches: [],
      nextActions: ['Open Intake', 'Open Review ops', 'Open Crawl runtime'],
    },
  }
}

function mockUserSession(membership: RestaurantMembership) {
  getSessionMock.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
      role: 'USER',
      restaurants: [membership],
    },
  })
}

function mockAdminSession() {
  getSessionMock.mockResolvedValue({
    user: {
      id: 'admin-1',
      email: 'admin@sentify.test',
      fullName: 'Alex Admin',
      role: 'ADMIN',
      restaurants: [],
    },
  })
}

beforeEach(() => {
  window.location.hash = ''

  const membership = makeMembership()
  const detail = makeDetail(membership)
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
  listAdminRestaurantsMock.mockResolvedValue([makeAdminSummary()])
  getAdminRestaurantDetailMock.mockResolvedValue(makeAdminDetail(makeAdminSummary()))
  loginMock.mockResolvedValue({
    expiresIn: 3600,
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
      role: 'USER',
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
      role: 'USER',
      restaurants: [],
    },
  })
  createRestaurantMock.mockResolvedValue(membership)
  updateRestaurantMock.mockResolvedValue(detail)
})

describe('Sentify app shell', () => {
  it('redirects guests away from protected routes', async () => {
    window.location.hash = '#/app'

    render(<App />)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/login')
    })
    expect(screen.getAllByRole('button', { name: 'Login' }).length).toBeGreaterThan(0)
  })

  it('renders the user shell without admin nav or copy', async () => {
    const membership = makeMembership()
    mockUserSession(membership)
    window.location.hash = '#/app'

    render(<App />)

    expect((await screen.findAllByText('User workspace')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Step 1 Dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 2 Reviews/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 3 Settings/i })).toBeInTheDocument()
    expect(screen.queryByText('Admin control plane')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Step 1 Restaurants overview/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Step 2 Intake/i })).not.toBeInTheDocument()
  })

  it('renders the admin shell on the /admin overview route', async () => {
    mockAdminSession()
    const adminSummary = makeAdminSummary()
    getAdminRestaurantDetailMock.mockResolvedValue(makeAdminDetail(adminSummary))
    listAdminRestaurantsMock.mockResolvedValue([adminSummary])
    window.location.hash = '#/admin'

    render(<App />)

    expect((await screen.findAllByText('Admin control plane')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Step 1 Restaurants/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 2 Intake/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 3 Review ops/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 4 Crawl runtime/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Step 1 Dashboard/i })).not.toBeInTheDocument()
  })

  it('allows a USER member to update restaurant settings', async () => {
    const membership = makeMembership()
    const detail = makeDetail(membership)
    const user = userEvent.setup()

    mockUserSession(membership)
    getRestaurantDetailMock.mockResolvedValue(detail)
    updateRestaurantMock.mockResolvedValue({
      ...detail,
      name: 'Cafe Aurora Updated',
      address: '456 River Street',
    })
    window.location.hash = '#/app/settings'

    render(<App />)

    expect(await screen.findByText('Restaurant settings')).toBeInTheDocument()

    const nameField = screen.getByLabelText('Restaurant name')
    const addressField = screen.getByLabelText('Address')

    await user.clear(nameField)
    await user.type(nameField, 'Cafe Aurora Updated')
    await user.clear(addressField)
    await user.type(addressField, '456 River Street')
    await user.click(screen.getAllByRole('button', { name: 'Save changes' })[0])

    await waitFor(() => {
      expect(updateRestaurantMock).toHaveBeenCalledWith('rest-1', {
        name: 'Cafe Aurora Updated',
        address: '456 River Street',
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Changes saved.')
  })

  it('fails closed across roles when the route does not match the active role', async () => {
    const membership = makeMembership()
    mockUserSession(membership)
    window.location.hash = '#/admin/intake'

    const firstRender = render(<App />)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/app')
    })
    expect(await screen.findByText('Operational triage dashboard')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 1 Dashboard/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Step 2 Intake/i })).not.toBeInTheDocument()

    firstRender.unmount()

    mockAdminSession()
    window.location.hash = '#/app/settings'

    render(<App />)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/admin')
    })
    expect((await screen.findAllByText('Restaurants overview')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Step 1 Restaurants/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Step 2 Intake/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Step 1 Dashboard/i })).not.toBeInTheDocument()
  })
})
