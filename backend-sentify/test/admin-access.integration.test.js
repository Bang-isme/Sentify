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
    const activeSession = {
        id: 'refresh-1',
        revokedAt: null,
        expiresAt: new Date('2026-04-01T00:00:00Z'),
    }
    const pendingReset = {
        id: 'reset-1',
        usedAt: null,
        expiresAt: new Date('2026-03-30T00:00:00Z'),
        createdAt: new Date('2026-03-24T09:00:00Z'),
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
        },
    ]

    let observedUserListWhere = null
    let resetRequestCount = 0

    function findUser(userId) {
        return users.find((user) => user.id === userId) ?? null
    }

    function findRestaurant(restaurantId) {
        return restaurants.find((restaurant) => restaurant.id === restaurantId) ?? null
    }

    function buildMembershipRecord(membership) {
        if (!membership) {
            return null
        }

        return {
            ...membership,
            user: findUser(membership.userId),
            restaurant: findRestaurant(membership.restaurantId),
        }
    }

    function projectUser(user, args = {}) {
        if (!user) {
            return null
        }

        const include = args.include ?? null

        return {
            ...user,
            restaurants: include?.restaurants
                ? memberships
                      .filter((membership) => membership.userId === user.id)
                      .map((membership) => buildMembershipRecord(membership))
                : undefined,
            refreshTokens: include?.refreshTokens ? [activeSession] : undefined,
            passwordResetTokens: include?.passwordResetTokens ? [pendingReset] : undefined,
            _count: include?._count
                ? {
                      intakeBatches: recentIntakeBatches.length,
                      requestedCrawlRuns: recentCrawlRuns.length,
                      restaurants: memberships.filter((membership) => membership.userId === user.id)
                          .length,
                  }
                : undefined,
        }
    }

    const prismaOverrides = {
        user: {
            findUnique: async (args) => {
                const user = findUser(args.where.id)
                return projectUser(user, args)
            },
            findMany: async (args = {}) => {
                if (args.where) {
                    observedUserListWhere = args.where
                }

                if (args.where?.role === 'USER' && args.include?._count) {
                    return users
                        .filter((user) => user.role === 'USER')
                        .map((user) => projectUser(user, args))
                }

                let list = users.slice()

                if (args.where?.AND) {
                    list = list.filter((user) => user.id === USER_ID)
                }

                return list.map((user) => projectUser(user, args))
            },
            count: async (args = {}) => {
                if (!args.where) {
                    return users.length
                }

                if (args.where.role) {
                    return users.filter((user) => user.role === args.where.role).length
                }

                if (args.where.lockedUntil?.gt) {
                    return users.filter(
                        (user) => user.lockedUntil && user.lockedUntil > args.where.lockedUntil.gt,
                    ).length
                }

                return users.length
            },
            update: async ({ where, data }) => {
                const user = findUser(where.id)
                Object.assign(user, data, {
                    updatedAt: new Date('2026-03-25T00:00:00Z'),
                })
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
            findMany: async () => memberships.map((membership) => buildMembershipRecord(membership)),
            findUnique: async ({ where }) =>
                buildMembershipRecord(
                    memberships.find((membership) => membership.id === where.id) ?? null,
                ),
            count: async () => memberships.length,
            create: async ({ data }) => {
                const membership = {
                    id: '55555555-5555-4555-8555-555555555555',
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
                where.createdByUserId === USER_ID ? recentIntakeBatches : [],
        },
        reviewCrawlRun: {
            findMany: async ({ where }) =>
                where.requestedByUserId === USER_ID ? recentCrawlRuns : [],
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
    assert.equal(listResponse.body.data.users.length, 1)
    assert.equal(listResponse.body.data.users[0].email, 'member@sentify.local')
    assert.equal(Array.isArray(state.observedUserListWhere.AND), true)
    assert.equal(state.observedUserListWhere.AND.length, 3)
    assert.deepEqual(state.observedUserListWhere.AND[0], {
        OR: [
            {
                email: {
                    contains: 'member',
                    mode: 'insensitive',
                },
            },
            {
                fullName: {
                    contains: 'member',
                    mode: 'insensitive',
                },
            },
        ],
    })
    assert.deepEqual(state.observedUserListWhere.AND[1], {
        role: 'USER',
    })
    assert.equal(state.observedUserListWhere.AND[2].OR[0].lockedUntil, null)
    assert.ok(state.observedUserListWhere.AND[2].OR[1].lockedUntil.lte instanceof Date)

    const detailResponse = await request(server, 'GET', `/api/admin/users/${USER_ID}`, {
        token: auth,
    })
    assert.equal(detailResponse.status, 200)
    assert.equal(detailResponse.body.data.user.id, USER_ID)
    assert.equal(detailResponse.body.data.user.role, 'USER')
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
