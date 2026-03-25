import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import {
  ApiClientError,
  createAdminMembership,
  createRestaurant,
  deleteAdminMembership,
  getAdminAudit,
  getAdminHealthJobs,
  getAdminIntegrationsPolicies,
  getAdminRestaurantDetail,
  getAdminUserDetail,
  getComplaintKeywords,
  getDashboardKpi,
  getRestaurantDetail,
  getSentimentBreakdown,
  getSession,
  getTrend,
  listAdminMemberships,
  listReviewEvidence,
  listAdminRestaurants,
  listAdminUsers,
  listRestaurants,
  login,
  logout,
  register,
  triggerAdminUserPasswordReset,
  updateAdminUserRole,
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
    createAdminMembership: vi.fn(),
    deleteAdminMembership: vi.fn(),
    getAdminAudit: vi.fn(),
    getAdminHealthJobs: vi.fn(),
    getAdminIntegrationsPolicies: vi.fn(),
    getAdminRestaurantDetail: vi.fn(),
    getAdminUserDetail: vi.fn(),
    getComplaintKeywords: vi.fn(),
    getDashboardKpi: vi.fn(),
    getRestaurantDetail: vi.fn(),
    getSentimentBreakdown: vi.fn(),
    getSession: vi.fn(),
    getTrend: vi.fn(),
    listAdminMemberships: vi.fn(),
    listReviewEvidence: vi.fn(),
    listAdminRestaurants: vi.fn(),
    listAdminUsers: vi.fn(),
    listRestaurants: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    triggerAdminUserPasswordReset: vi.fn(),
    updateAdminUserRole: vi.fn(),
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
const listReviewEvidenceMock = vi.mocked(listReviewEvidence)
const listAdminRestaurantsMock = vi.mocked(listAdminRestaurants)
const getAdminRestaurantDetailMock = vi.mocked(getAdminRestaurantDetail)
const listAdminUsersMock = vi.mocked(listAdminUsers)
const getAdminUserDetailMock = vi.mocked(getAdminUserDetail)
const listAdminMembershipsMock = vi.mocked(listAdminMemberships)
const createAdminMembershipMock = vi.mocked(createAdminMembership)
const deleteAdminMembershipMock = vi.mocked(deleteAdminMembership)
const getAdminHealthJobsMock = vi.mocked(getAdminHealthJobs)
const getAdminIntegrationsPoliciesMock = vi.mocked(getAdminIntegrationsPolicies)
const getAdminAuditMock = vi.mocked(getAdminAudit)
const updateAdminUserRoleMock = vi.mocked(updateAdminUserRole)
const triggerAdminUserPasswordResetMock = vi.mocked(triggerAdminUserPasswordReset)
const loginMock = vi.mocked(login)
const logoutMock = vi.mocked(logout)
const registerMock = vi.mocked(register)
const createRestaurantMock = vi.mocked(createRestaurant)
const updateRestaurantMock = vi.mocked(updateRestaurant)

const defaultPlatformControls = {
  id: 'platform',
  crawlQueueWritesEnabled: true,
  crawlMaterializationEnabled: true,
  intakePublishEnabled: true,
  note: null,
  updatedByUserId: 'admin-1',
  createdAt: '2026-03-25T00:00:00.000Z',
  updatedAt: '2026-03-25T00:00:00.000Z',
}

const defaultLifecyclePolicy =
  'LOCK revokes active sessions and blocks access until UNLOCK. DEACTIVATE disables login and all active sessions until REACTIVATE.'

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
  const reviewEvidence = {
    data: [
      {
        id: 'review-1',
        externalId: 'ext-1',
        authorName: 'Jordan',
        rating: 2,
        content: 'Wait time was too long.',
        sentiment: 'NEGATIVE' as const,
        reviewDate: '2026-03-25T00:00:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  }

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
  listReviewEvidenceMock.mockResolvedValue(reviewEvidence)
  listAdminRestaurantsMock.mockResolvedValue([makeAdminSummary()])
  getAdminRestaurantDetailMock.mockResolvedValue(makeAdminDetail(makeAdminSummary()))
  listAdminUsersMock.mockResolvedValue({
    summary: {
      totalUsers: 2,
      adminCount: 1,
      userCount: 1,
      lockedUserCount: 0,
      membershipCount: 1,
      visibleUsers: 2,
    },
    filters: {
      search: null,
      role: null,
      accountState: null,
    },
    users: [
      {
        id: 'user-1',
        email: 'owner@sentify.test',
        fullName: 'Casey Owner',
        role: 'USER',
        accountState: 'ACTIVE',
        restaurantCount: 1,
        activeSessionCount: 1,
        pendingPasswordResetCount: 0,
        createdIntakeBatchCount: 1,
        requestedCrawlRunCount: 1,
        failedLoginCount: 0,
      tokenVersion: 0,
      lastLoginAt: '2026-03-25T00:00:00.000Z',
      lockedUntil: null,
      manuallyLockedAt: null,
      deactivatedAt: null,
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
      {
        id: 'admin-1',
        email: 'admin@sentify.test',
        fullName: 'Alex Admin',
        role: 'ADMIN',
        accountState: 'ACTIVE',
        restaurantCount: 0,
        activeSessionCount: 2,
        pendingPasswordResetCount: 0,
        createdIntakeBatchCount: 0,
        requestedCrawlRunCount: 0,
        failedLoginCount: 0,
      tokenVersion: 0,
      lastLoginAt: '2026-03-25T00:00:00.000Z',
      lockedUntil: null,
      manuallyLockedAt: null,
      deactivatedAt: null,
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
    ],
  })
  getAdminUserDetailMock.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
      role: 'USER',
      accountState: 'ACTIVE',
      restaurantCount: 1,
      activeSessionCount: 1,
      pendingPasswordResetCount: 0,
      createdIntakeBatchCount: 1,
      requestedCrawlRunCount: 1,
      failedLoginCount: 0,
      tokenVersion: 0,
      lastLoginAt: '2026-03-25T00:00:00.000Z',
      lockedUntil: null,
      manuallyLockedAt: null,
      deactivatedAt: null,
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
      canEditRole: true,
      availableRoleTargets: ['USER', 'ADMIN'],
      availableAccountActions: ['LOCK', 'DEACTIVATE'],
      roleChangePolicy: 'Role changes stay in admin access only.',
      lifecyclePolicy: defaultLifecyclePolicy,
    },
    memberships: [
      {
        id: 'membership-1',
        createdAt: '2026-03-25T00:00:00.000Z',
        user: {
          id: 'user-1',
          email: 'owner@sentify.test',
          fullName: 'Casey Owner',
          role: 'USER',
        },
        restaurant: {
          id: 'rest-1',
          name: 'Cafe Aurora',
          slug: 'cafe-aurora',
          address: '123 Market Street',
          googleMapUrl: 'https://maps.google.com/cafe-aurora',
        },
      },
    ],
    security: {
      activeSessionCount: 1,
      pendingPasswordResetCount: 0,
      failedLoginCount: 0,
      tokenVersion: 0,
      lastLoginAt: '2026-03-25T00:00:00.000Z',
      lockedUntil: null,
      manuallyLockedAt: null,
      deactivatedAt: null,
    },
    recentIntakeBatches: [],
    recentCrawlRuns: [],
  })
  listAdminMembershipsMock.mockResolvedValue({
    summary: {
      totalMemberships: 1,
      visibleMemberships: 1,
      userCount: 1,
      restaurantCount: 1,
    },
    filters: {
      userId: null,
      restaurantId: null,
    },
    memberships: [
      {
        id: 'membership-1',
        createdAt: '2026-03-25T00:00:00.000Z',
        user: {
          id: 'user-1',
          email: 'owner@sentify.test',
          fullName: 'Casey Owner',
          role: 'USER',
        },
        restaurant: {
          id: 'rest-1',
          name: 'Cafe Aurora',
          slug: 'cafe-aurora',
          address: '123 Market Street',
          googleMapUrl: 'https://maps.google.com/cafe-aurora',
        },
      },
    ],
    users: [
      {
        id: 'user-1',
        email: 'owner@sentify.test',
        fullName: 'Casey Owner',
        role: 'USER',
        accountState: 'ACTIVE',
        restaurantCount: 1,
      },
    ],
    restaurants: [
      {
        id: 'rest-1',
        name: 'Cafe Aurora',
        slug: 'cafe-aurora',
        address: '123 Market Street',
        googleMapUrl: 'https://maps.google.com/cafe-aurora',
        memberCount: 1,
      },
    ],
  })
  createAdminMembershipMock.mockResolvedValue({
    membership: {
      id: 'membership-2',
      createdAt: '2026-03-25T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'owner@sentify.test',
        fullName: 'Casey Owner',
        role: 'USER',
      },
      restaurant: {
        id: 'rest-1',
        name: 'Cafe Aurora',
        slug: 'cafe-aurora',
        address: '123 Market Street',
        googleMapUrl: 'https://maps.google.com/cafe-aurora',
      },
    },
  })
  deleteAdminMembershipMock.mockResolvedValue({
    membership: {
      id: 'membership-1',
      createdAt: '2026-03-25T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'owner@sentify.test',
        fullName: 'Casey Owner',
        role: 'USER',
      },
      restaurant: {
        id: 'rest-1',
        name: 'Cafe Aurora',
        slug: 'cafe-aurora',
        address: '123 Market Street',
        googleMapUrl: 'https://maps.google.com/cafe-aurora',
      },
    },
  })
  getAdminHealthJobsMock.mockResolvedValue({
    generatedAt: '2026-03-25T00:00:00.000Z',
    services: {
      api: {
        status: 'UP',
        checkedAt: '2026-03-25T00:00:00.000Z',
        uptimeSeconds: 100,
        nodeEnv: 'test',
      },
      database: {
        status: 'UP',
        checkedAt: '2026-03-25T00:00:00.000Z',
      },
      queue: {
        status: 'HEALTHY',
        configured: true,
        inlineMode: false,
        queueName: 'review-crawl',
        counts: { waiting: 1, active: 0 },
      },
      workers: {
        status: 'HEALTHY',
        configured: true,
        scheduler: {},
        processors: [{}],
        processorCount: 1,
      },
    },
    jobs: {
      queueName: 'review-crawl',
      runtimeMode: 'worker',
      concurrency: 4,
      counts: {
        queued: 1,
        running: 0,
        failed: 0,
        completed: 2,
      },
      recentRuns: [],
    },
    controls: defaultPlatformControls,
    recovery: {
      proofArtifacts: [],
      releaseReadiness: {
        localProofStatus: 'LOCAL_PROOF_COMPLETE',
        localProofCoverage: {
          requiredArtifactKeys: ['queue-smoke', 'ops-sync-draft', 'recovery-drill'],
          availableArtifactKeys: ['queue-smoke', 'ops-sync-draft', 'recovery-drill'],
          missingArtifactKeys: [],
        },
        managedEnvProofStatus: 'PENDING',
        managedEnvGap: 'Managed staging and production recovery proof has not been recorded yet.',
      },
    },
  })
  getAdminIntegrationsPoliciesMock.mockResolvedValue({
    generatedAt: '2026-03-25T00:00:00.000Z',
    roleModel: {
      systemRoles: ['USER', 'ADMIN'],
      restaurantMembershipModel: 'BINARY_MEMBERSHIP',
      membershipPermissions: false,
      adminRequiresRestaurantMembership: false,
      userRequiresRestaurantMembership: true,
    },
    routeBoundary: {
      merchantBasePath: '/api/restaurants',
      adminBasePath: '/api/admin',
      merchantRole: 'USER',
      adminRole: 'ADMIN',
    },
    integrations: [],
    policies: {
      sourcePolicy: 'ADMIN_CURATED',
      publishPolicy: 'MANUAL_PUBLISH',
      crawlDefaults: {},
      sourceCoverage: {
        restaurantCount: 2,
        googleMapLinkedRestaurants: 1,
        sourceCount: 1,
        activeSourceCount: 1,
        disabledSourceCount: 0,
        restaurantsWithoutSourceCount: 1,
      },
      runtimeControls: defaultPlatformControls,
    },
    environment: {
      nodeEnv: 'test',
      appUrl: 'http://localhost:5173',
      corsOrigins: ['http://localhost:5173'],
      bodyLimit: '1mb',
      authCookieSameSite: 'lax',
      emailProvider: 'console',
    },
  })
  getAdminAuditMock.mockResolvedValue({
    generatedAt: '2026-03-25T00:00:00.000Z',
    limit: 25,
    summary: {
      totalEvents: 2,
      byAction: {
        USER_CREATED: 1,
        MEMBERSHIP_ASSIGNED: 1,
      },
    },
    items: [
      {
        id: 'audit-1',
        timestamp: '2026-03-25T00:00:00.000Z',
        action: 'USER_CREATED',
        resourceType: 'user',
        resourceId: 'user-1',
        restaurant: null,
        actor: null,
        summary: 'User created',
        metadata: {},
      },
    ],
  })
  updateAdminUserRoleMock.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
      role: 'ADMIN',
      accountState: 'ACTIVE',
      restaurantCount: 0,
      activeSessionCount: 1,
      pendingPasswordResetCount: 0,
      createdIntakeBatchCount: 1,
      requestedCrawlRunCount: 1,
      failedLoginCount: 0,
      tokenVersion: 0,
      lastLoginAt: '2026-03-25T00:00:00.000Z',
      lockedUntil: null,
      manuallyLockedAt: null,
      deactivatedAt: null,
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
      canEditRole: true,
      availableRoleTargets: ['USER', 'ADMIN'],
      availableAccountActions: ['LOCK', 'DEACTIVATE'],
      roleChangePolicy: 'Role changes stay in admin access only.',
      lifecyclePolicy: defaultLifecyclePolicy,
    },
    memberships: [],
    security: {
      activeSessionCount: 1,
      pendingPasswordResetCount: 0,
      failedLoginCount: 0,
      tokenVersion: 0,
      lastLoginAt: '2026-03-25T00:00:00.000Z',
      lockedUntil: null,
      manuallyLockedAt: null,
      deactivatedAt: null,
    },
    recentIntakeBatches: [],
    recentCrawlRuns: [],
  })
  triggerAdminUserPasswordResetMock.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'owner@sentify.test',
      fullName: 'Casey Owner',
    },
    message: 'If the email is registered, a reset link has been sent.',
  })
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
    expect(screen.getByTestId('auth-shell')).toBeInTheDocument()
    expect(screen.getByTestId('auth-submit')).toBeInTheDocument()
  })

  it('renders the user shell without admin nav or copy', async () => {
    const membership = makeMembership()
    mockUserSession(membership)
    window.location.hash = '#/app'

    render(<App />)

    expect(await screen.findByTestId('merchant-shell')).toBeInTheDocument()
    expect(screen.getByTestId('merchant-nav')).toBeInTheDocument()
    expect(screen.getByTestId('nav-app')).toBeInTheDocument()
    expect(screen.getByTestId('nav-app-reviews')).toBeInTheDocument()
    expect(screen.getByTestId('nav-app-actions')).toBeInTheDocument()
    expect(screen.getByTestId('nav-app-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-nav')).not.toBeInTheDocument()
  })

  it('renders the admin shell on the /admin overview route', async () => {
    mockAdminSession()
    const adminSummary = makeAdminSummary()
    getAdminRestaurantDetailMock.mockResolvedValue(makeAdminDetail(adminSummary))
    listAdminRestaurantsMock.mockResolvedValue([adminSummary])
    window.location.hash = '#/admin'

    render(<App />)

    expect(await screen.findByTestId('admin-shell')).toBeInTheDocument()
    expect(screen.getByTestId('admin-nav')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-operations-restaurants')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-operations-intake')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-operations-review-ops')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-operations-crawl')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-access-users')).toBeInTheDocument()
    expect(screen.queryByTestId('merchant-nav')).not.toBeInTheDocument()
  })

  it('renders live admin access and platform screens instead of placeholders', async () => {
    mockAdminSession()
    window.location.hash = '#/admin/access/users'

    const firstRender = render(<App />)

    expect(await screen.findByTestId('admin-users-screen')).toBeInTheDocument()

    firstRender.unmount()

    mockAdminSession()
    window.location.hash = '#/admin/platform/health-jobs'

    render(<App />)

    expect(await screen.findByTestId('admin-health-jobs-screen')).toBeInTheDocument()
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

    expect(await screen.findByTestId('merchant-settings-screen')).toBeInTheDocument()
    expect(screen.getByTestId('settings-form')).toBeInTheDocument()

    const nameField = screen.getByTestId('restaurant-name-input')
    const addressField = screen.getByTestId('restaurant-address-input')

    await user.clear(nameField)
    await user.type(nameField, 'Cafe Aurora Updated')
    await user.clear(addressField)
    await user.type(addressField, '456 River Street')
    await user.click(screen.getByTestId('save-profile'))

    await waitFor(() => {
      expect(updateRestaurantMock).toHaveBeenCalledWith('rest-1', {
        name: 'Cafe Aurora Updated',
        address: '456 River Street',
      })
    })
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('fails closed across roles when the route does not match the active role', async () => {
    const membership = makeMembership()
    mockUserSession(membership)
    window.location.hash = '#/admin/operations/intake'

    const firstRender = render(<App />)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/app')
    })
    expect(await screen.findByTestId('merchant-home-screen')).toBeInTheDocument()
    expect(screen.getByTestId('nav-app')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-admin-operations-intake')).not.toBeInTheDocument()

    firstRender.unmount()

    mockAdminSession()
    window.location.hash = '#/app/settings'

    render(<App />)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/admin')
    })
    expect(await screen.findByTestId('admin-home-screen')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-operations-restaurants')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-operations-intake')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-app')).not.toBeInTheDocument()
  })
})
