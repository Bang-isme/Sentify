const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333'
const MEMBERSHIP_ID = '44444444-4444-4444-8444-444444444444'

function createAdminAccessPrismaOverrides() {
    const users = [
        {
            id: ADMIN_ID,
            email: 'admin@sentify.local',
            fullName: 'Admin One',
            role: 'ADMIN',
            tokenVersion: 0,
            failedLoginCount: 0,
            lastLoginAt: new Date('2026-03-24T10:00:00Z'),
            lockedUntil: null,
            manuallyLockedAt: null,
            deactivatedAt: null,
            createdAt: new Date('2026-03-20T00:00:00Z'),
            updatedAt: new Date('2026-03-24T10:00:00Z'),
        },
        {
            id: USER_ID,
            email: 'member@sentify.local',
            fullName: 'Morgan Member',
            role: 'USER',
            tokenVersion: 1,
            failedLoginCount: 2,
            lastLoginAt: new Date('2026-03-24T08:30:00Z'),
            lockedUntil: null,
            manuallyLockedAt: null,
            deactivatedAt: null,
            createdAt: new Date('2026-03-21T00:00:00Z'),
            updatedAt: new Date('2026-03-24T08:30:00Z'),
        },
    ]
    const restaurants = [
        {
            id: RESTAURANT_ID,
            name: 'Cafe One',
            slug: 'cafe-one',
            address: '1 Demo Street',
            googleMapUrl: 'https://maps.app.goo.gl/demo',
            createdAt: new Date('2026-03-01T00:00:00Z'),
            updatedAt: new Date('2026-03-10T00:00:00Z'),
        },
    ]
    const memberships = [
        {
            id: MEMBERSHIP_ID,
            userId: USER_ID,
            restaurantId: RESTAURANT_ID,
            createdAt: new Date('2026-03-22T00:00:00Z'),
        },
    ]
    const refreshTokensByUserId = {
        [USER_ID]: [
            {
                id: 'refresh-1',
                revokedAt: null,
                expiresAt: new Date('2026-04-01T00:00:00Z'),
            },
        ],
    }
    const passwordResetTokensByUserId = {
        [USER_ID]: [
            {
                id: 'reset-1',
                usedAt: null,
                expiresAt: new Date('2026-03-30T00:00:00Z'),
                createdAt: new Date('2026-03-24T09:00:00Z'),
            },
        ],
    }
    const recentIntakeBatches = [
        {
            id: 'batch-1',
            title: 'Manual intake',
            status: 'DRAFT',
            sourceType: 'MANUAL',
            createdAt: new Date('2026-03-23T00:00:00Z'),
            publishedAt: null,
            restaurant: {
                id: RESTAURANT_ID,
                name: 'Cafe One',
                slug: 'cafe-one',
            },
            createdByUserId: USER_ID,
        },
    ]
    const recentCrawlRuns = [
        {
            id: 'run-1',
            status: 'PARTIAL',
            strategy: 'INCREMENTAL',
            priority: 'NORMAL',
            queuedAt: new Date('2026-03-24T00:00:00Z'),
            finishedAt: new Date('2026-03-24T00:02:00Z'),
            restaurant: {
                id: RESTAURANT_ID,
                name: 'Cafe One',
                slug: 'cafe-one',
            },
            requestedByUserId: USER_ID,
        },
    ]

    let observedUserListWhere = null
    let resetRequestCount = 0
    let createdUserCount = 0

    function findUserById(userId) {
        return users.find((user) => user.id === userId) ?? null
    }

    function findUserByEmail(email) {
        return users.find((user) => user.email === email) ?? null
    }

    function findRestaurant(restaurantId) {
        return restaurants.find((restaurant) => restaurant.id === restaurantId) ?? null
    }

    function getRefreshTokens(userId) {
        return refreshTokensByUserId[userId] ?? []
    }

    function getPasswordResetTokens(userId) {
        return passwordResetTokensByUserId[userId] ?? []
    }

    function matchesDateCondition(value, condition) {
        if (condition === null) {
            return value === null
        }

        if (!condition) {
            return true
        }

        if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
            return condition.not === null ? value !== null : value !== condition.not
        }

        if (Object.prototype.hasOwnProperty.call(condition, 'gt')) {
            return value instanceof Date && value > condition.gt
        }

        if (Object.prototype.hasOwnProperty.call(condition, 'lte')) {
            return value === null || value <= condition.lte
        }

        return true
    }

    function matchesUserWhere(user, where) {
        if (!where || Object.keys(where).length === 0) {
            return true
        }

        if (Array.isArray(where.AND)) {
            return where.AND.every((clause) => matchesUserWhere(user, clause))
        }

        if (Array.isArray(where.OR)) {
            return where.OR.some((clause) => matchesUserWhere(user, clause))
        }

        if (where.role && user.role !== where.role) {
            return false
        }

        if (where.id?.not && user.id === where.id.not) {
            return false
        }

        if (where.email?.contains) {
            return user.email.toLowerCase().includes(String(where.email.contains).toLowerCase())
        }

        if (where.fullName?.contains) {
            return user.fullName
                .toLowerCase()
                .includes(String(where.fullName.contains).toLowerCase())
        }

        if (Object.prototype.hasOwnProperty.call(where, 'deactivatedAt')) {
            return matchesDateCondition(user.deactivatedAt, where.deactivatedAt)
        }

        if (Object.prototype.hasOwnProperty.call(where, 'manuallyLockedAt')) {
            return matchesDateCondition(user.manuallyLockedAt, where.manuallyLockedAt)
        }

        if (Object.prototype.hasOwnProperty.call(where, 'lockedUntil')) {
            return matchesDateCondition(user.lockedUntil, where.lockedUntil)
        }

        return true
    }

    function buildMembershipRecord(membership) {
        if (!membership) {
            return null
        }

        return {
            ...membership,
            user: findUserById(membership.userId),
            restaurant: findRestaurant(membership.restaurantId),
        }
    }

    function projectUser(user, args = {}) {
        if (!user) {
            return null
        }

        const include = args.include ?? null
        const select = args.select ?? null

        if (select) {
            const projected = {}
            for (const key of Object.keys(select)) {
                if (key === '_count') {
                    projected._count = {
                        restaurants: memberships.filter(
                            (membership) => membership.userId === user.id,
                        ).length,
                    }
                    continue
                }

                projected[key] = user[key]
            }
            return projected
        }

        return {
            ...user,
            restaurants: include?.restaurants
                ? memberships
                      .filter((membership) => membership.userId === user.id)
                      .map((membership) => buildMembershipRecord(membership))
                : undefined,
            refreshTokens: include?.refreshTokens ? getRefreshTokens(user.id) : undefined,
            passwordResetTokens: include?.passwordResetTokens
                ? getPasswordResetTokens(user.id)
                : undefined,
            _count: include?._count
                ? {
                      intakeBatches: recentIntakeBatches.filter(
                          (batch) => batch.createdByUserId === user.id,
                      ).length,
                      requestedCrawlRuns: recentCrawlRuns.filter(
                          (run) => run.requestedByUserId === user.id,
                      ).length,
                      restaurants: memberships.filter((membership) => membership.userId === user.id)
                          .length,
                  }
                : undefined,
        }
    }

    function applyUserUpdate(user, data) {
        if (Object.prototype.hasOwnProperty.call(data, 'email')) {
            user.email = data.email
        }
        if (Object.prototype.hasOwnProperty.call(data, 'fullName')) {
            user.fullName = data.fullName
        }
        if (Object.prototype.hasOwnProperty.call(data, 'role')) {
            user.role = data.role
        }
        if (Object.prototype.hasOwnProperty.call(data, 'passwordHash')) {
            user.passwordHash = data.passwordHash
        }
        if (Object.prototype.hasOwnProperty.call(data, 'failedLoginCount')) {
            user.failedLoginCount = data.failedLoginCount
        }
        if (Object.prototype.hasOwnProperty.call(data, 'lockedUntil')) {
            user.lockedUntil = data.lockedUntil
        }
        if (Object.prototype.hasOwnProperty.call(data, 'manuallyLockedAt')) {
            user.manuallyLockedAt = data.manuallyLockedAt
        }
        if (Object.prototype.hasOwnProperty.call(data, 'deactivatedAt')) {
            user.deactivatedAt = data.deactivatedAt
        }
        if (Object.prototype.hasOwnProperty.call(data, 'lastLoginAt')) {
            user.lastLoginAt = data.lastLoginAt
        }
        if (Object.prototype.hasOwnProperty.call(data, 'tokenVersion')) {
            if (typeof data.tokenVersion === 'object' && data.tokenVersion.increment) {
                user.tokenVersion += data.tokenVersion.increment
            } else {
                user.tokenVersion = data.tokenVersion
            }
        }

        user.updatedAt = new Date('2026-03-25T00:00:00Z')
    }

    const prismaOverrides = {
        user: {
            findUnique: async (args) => {
                const user = args.where.id
                    ? findUserById(args.where.id)
                    : findUserByEmail(args.where.email)
                return projectUser(user, args)
            },
            findMany: async (args = {}) => {
                if (args.where) {
                    observedUserListWhere = args.where
                }

                return users
                    .filter((user) => matchesUserWhere(user, args.where))
                    .map((user) => projectUser(user, args))
            },
            count: async (args = {}) =>
                users.filter((user) => matchesUserWhere(user, args.where)).length,
            create: async ({ data, select }) => {
                createdUserCount += 1
                const user = {
                    id: `99999999-9999-4999-8999-00000000000${createdUserCount}`,
                    email: data.email,
                    fullName: data.fullName,
                    role: data.role,
                    passwordHash: data.passwordHash,
                    tokenVersion: 0,
                    failedLoginCount: 0,
                    lastLoginAt: null,
                    lockedUntil: null,
                    manuallyLockedAt: null,
                    deactivatedAt: null,
                    createdAt: new Date('2026-03-25T02:00:00Z'),
                    updatedAt: new Date('2026-03-25T02:00:00Z'),
                }
                users.push(user)
                return select ? { id: user.id } : projectUser(user)
            },
            update: async ({ where, data }) => {
                const user = findUserById(where.id)
                applyUserUpdate(user, data)
                return projectUser(user)
            },
        },
        restaurant: {
            findUnique: async ({ where }) => findRestaurant(where.id),
            findMany: async (args = {}) =>
                restaurants.map((restaurant) => ({
                    ...restaurant,
                    _count: args.include?._count
                        ? {
                              users: memberships.filter(
                                  (membership) => membership.restaurantId === restaurant.id,
                              ).length,
                          }
                        : undefined,
                })),
        },
        restaurantUser: {
            findMany: async ({ where } = {}) =>
                memberships
                    .filter((membership) => {
                        if (!where) {
                            return true
                        }

                        if (where.userId && membership.userId !== where.userId) {
                            return false
                        }

                        if (
                            where.restaurantId &&
                            membership.restaurantId !== where.restaurantId
                        ) {
                            return false
                        }

                        return true
                    })
                    .map((membership) => buildMembershipRecord(membership)),
            findUnique: async ({ where }) =>
                buildMembershipRecord(
                    memberships.find((membership) => membership.id === where.id) ?? null,
                ),
            count: async () => memberships.length,
            create: async ({ data }) => {
                const membership = {
                    id: `55555555-5555-4555-8555-55555555555${memberships.length}`,
                    userId: data.userId,
                    restaurantId: data.restaurantId,
                    createdAt: new Date('2026-03-25T01:00:00Z'),
                }
                memberships.push(membership)
                return buildMembershipRecord(membership)
            },
            delete: async ({ where }) => {
                const index = memberships.findIndex((membership) => membership.id === where.id)
                memberships.splice(index, 1)
                return { id: where.id }
            },
            deleteMany: async ({ where }) => {
                const before = memberships.length
                for (let index = memberships.length - 1; index >= 0; index -= 1) {
                    if (memberships[index].userId === where.userId) {
                        memberships.splice(index, 1)
                    }
                }

                return { count: before - memberships.length }
            },
        },
        reviewIntakeBatch: {
            findMany: async ({ where }) =>
                recentIntakeBatches.filter((batch) => batch.createdByUserId === where.createdByUserId),
        },
        reviewCrawlRun: {
            findMany: async ({ where }) =>
                recentCrawlRuns.filter((run) => run.requestedByUserId === where.requestedByUserId),
        },
    }

    return {
        prismaOverrides,
        state: {
            users,
            memberships,
            get observedUserListWhere() {
                return observedUserListWhere
            },
            get resetRequestCount() {
                return resetRequestCount
            },
            get createdUserCount() {
                return createdUserCount
            },
            incrementResetRequestCount() {
                resetRequestCount += 1
            },
        },
    }
}

test('admin access endpoints expose user directory, detail, role changes, and reset actions', async (t) => {
    const { prismaOverrides, state } = createAdminAccessPrismaOverrides()
    const { server } = await startApp(prismaOverrides, {
        passwordResetServiceOverrides: {
            requestPasswordReset: async () => {
                state.incrementResetRequestCount()
                return {
                    message: 'If the email is registered, a reset link has been sent.',
                }
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: ADMIN_ID, tokenVersion: 0 })

    const listResponse = await request(
        server,
        'GET',
        '/api/admin/users?search=member&role=USER&accountState=ACTIVE',
        { token: auth },
    )
    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.data.summary.totalUsers, 2)
    assert.equal(listResponse.body.data.summary.adminCount, 1)
    assert.equal(listResponse.body.data.summary.userCount, 1)
    assert.equal(listResponse.body.data.summary.deactivatedUserCount, 0)
    assert.equal(listResponse.body.data.users.length, 1)
    assert.equal(listResponse.body.data.users[0].email, 'member@sentify.local')
    assert.equal(Array.isArray(state.observedUserListWhere.AND), true)
    assert.equal(state.observedUserListWhere.AND.length, 5)

    const detailResponse = await request(server, 'GET', `/api/admin/users/${USER_ID}`, {
        token: auth,
    })
    assert.equal(detailResponse.status, 200)
    assert.equal(detailResponse.body.data.user.id, USER_ID)
    assert.equal(detailResponse.body.data.user.role, 'USER')
    assert.deepEqual(detailResponse.body.data.user.availableAccountActions, ['LOCK', 'DEACTIVATE'])
    assert.equal(detailResponse.body.data.memberships.length, 1)
    assert.equal(detailResponse.body.data.recentIntakeBatches.length, 1)
    assert.equal(detailResponse.body.data.recentCrawlRuns.length, 1)

    const roleResponse = await request(server, 'PATCH', `/api/admin/users/${USER_ID}/role`, {
        token: auth,
        body: {
            role: 'ADMIN',
        },
    })
    assert.equal(roleResponse.status, 200)
    assert.equal(roleResponse.body.data.user.role, 'ADMIN')
    assert.equal(roleResponse.body.data.memberships.length, 0)
    assert.equal(state.users.find((user) => user.id === USER_ID)?.role, 'ADMIN')
    assert.equal(state.memberships.length, 0)

    const resetResponse = await request(
        server,
        'POST',
        `/api/admin/users/${USER_ID}/password-reset`,
        { token: auth },
    )
    assert.equal(resetResponse.status, 200)
    assert.equal(resetResponse.body.data.user.email, 'member@sentify.local')
    assert.equal(
        resetResponse.body.data.message,
        'If the email is registered, a reset link has been sent.',
    )
    assert.equal(state.resetRequestCount, 1)
})

test('admin access lifecycle endpoints create users and manage account state safely', async (t) => {
    const { prismaOverrides, state } = createAdminAccessPrismaOverrides()
    const revokedUserIds = []
    const { server } = await startApp(prismaOverrides, {
        refreshTokenServiceOverrides: {
            revokeAllUserTokens: async (userId) => {
                revokedUserIds.push(userId)
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: ADMIN_ID, tokenVersion: 0 })

    const createResponse = await request(server, 'POST', '/api/admin/users', {
        token: auth,
        body: {
            email: 'new.user@sentify.local',
            fullName: 'New User',
            role: 'USER',
            password: 'DemoPass123!',
            restaurantId: RESTAURANT_ID,
        },
    })
    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.data.user.email, 'new.user@sentify.local')
    assert.equal(createResponse.body.data.user.accountState, 'ACTIVE')
    assert.equal(createResponse.body.data.memberships.length, 1)
    assert.equal(state.createdUserCount, 1)

    const createdUserId = createResponse.body.data.user.id

    const lockResponse = await request(
        server,
        'PATCH',
        `/api/admin/users/${createdUserId}/account-state`,
        {
            token: auth,
            body: {
                action: 'LOCK',
            },
        },
    )
    assert.equal(lockResponse.status, 200)
    assert.equal(lockResponse.body.data.user.accountState, 'LOCKED')
    assert.equal(lockResponse.body.data.security.manuallyLockedAt !== null, true)
    assert.deepEqual(revokedUserIds, [createdUserId])

    const unlockResponse = await request(
        server,
        'PATCH',
        `/api/admin/users/${createdUserId}/account-state`,
        {
            token: auth,
            body: {
                action: 'UNLOCK',
            },
        },
    )
    assert.equal(unlockResponse.status, 200)
    assert.equal(unlockResponse.body.data.user.accountState, 'ACTIVE')

    const deactivateResponse = await request(
        server,
        'PATCH',
        `/api/admin/users/${createdUserId}/account-state`,
        {
            token: auth,
            body: {
                action: 'DEACTIVATE',
            },
        },
    )
    assert.equal(deactivateResponse.status, 200)
    assert.equal(deactivateResponse.body.data.user.accountState, 'DEACTIVATED')
    assert.equal(deactivateResponse.body.data.security.deactivatedAt !== null, true)

    const reactivateResponse = await request(
        server,
        'PATCH',
        `/api/admin/users/${createdUserId}/account-state`,
        {
            token: auth,
            body: {
                action: 'REACTIVATE',
            },
        },
    )
    assert.equal(reactivateResponse.status, 200)
    assert.equal(reactivateResponse.body.data.user.accountState, 'ACTIVE')

    const selfDeactivateResponse = await request(
        server,
        'PATCH',
        `/api/admin/users/${ADMIN_ID}/account-state`,
        {
            token: auth,
            body: {
                action: 'DEACTIVATE',
            },
        },
    )
    assert.equal(selfDeactivateResponse.status, 403)
})

test('admin membership endpoints expose the graph and support create/delete', async (t) => {
    const { prismaOverrides, state } = createAdminAccessPrismaOverrides()
    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: ADMIN_ID, tokenVersion: 0 })

    const listResponse = await request(server, 'GET', '/api/admin/memberships', {
        token: auth,
    })
    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.data.summary.totalMemberships, 1)
    assert.equal(listResponse.body.data.memberships.length, 1)
    assert.equal(listResponse.body.data.users.length, 1)
    assert.equal(listResponse.body.data.users[0].accountState, 'ACTIVE')
    assert.equal(listResponse.body.data.restaurants.length, 1)

    const deleteResponse = await request(
        server,
        'DELETE',
        `/api/admin/memberships/${MEMBERSHIP_ID}`,
        {
            token: auth,
        },
    )
    assert.equal(deleteResponse.status, 200)
    assert.equal(deleteResponse.body.data.membership.id, MEMBERSHIP_ID)
    assert.equal(state.memberships.length, 0)

    const createResponse = await request(server, 'POST', '/api/admin/memberships', {
        token: auth,
        body: {
            userId: USER_ID,
            restaurantId: RESTAURANT_ID,
        },
    })
    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.data.membership.user.id, USER_ID)
    assert.equal(createResponse.body.data.membership.restaurant.id, RESTAURANT_ID)
    assert.equal(state.memberships.length, 1)
})

test('admin access endpoints stay hidden from non-admin users', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === USER_ID) {
                    return {
                        id: USER_ID,
                        role: 'USER',
                        tokenVersion: 0,
                        lockedUntil: null,
                        manuallyLockedAt: null,
                        deactivatedAt: null,
                    }
                }

                return null
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: USER_ID, tokenVersion: 0 })
    const response = await request(server, 'GET', '/api/admin/users', {
        token: auth,
    })
    assert.equal(response.status, 403)
})
