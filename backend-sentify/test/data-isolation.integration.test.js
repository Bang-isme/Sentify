const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_A = '00000000-0000-0000-0000-00000000000a'
const RESTAURANT_B = '00000000-0000-0000-0000-00000000000b'
const BATCH_ID = '00000000-0000-0000-0000-0000000000b1'

test('data isolation blocks cross-restaurant access', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }
                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_A) {
                    return {
                        restaurant: {
                            id: RESTAURANT_A,
                            name: 'Alpha',
                            slug: 'alpha',
                            address: null,
                            googleMapUrl: null,
                            createdAt: new Date('2026-03-01T00:00:00Z'),
                            updatedAt: new Date('2026-03-01T00:00:00Z'),
                            insight: {
                                totalReviews: 1,
                                averageRating: 5,
                                positivePercentage: 100,
                                neutralPercentage: 0,
                                negativePercentage: 0,
                            },
                        },
                    }
                }

                return null
            },
        },
        complaintKeyword: {
            findFirst: async () => null,
        },
        review: {
            groupBy: async () => [],
            count: async () => 0,
        },
        $queryRaw: async () => [],
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const allowed = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_A}/dashboard/kpi`,
        { token: auth },
    )
    assert.equal(allowed.status, 200)

    const forbidden = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_B}/dashboard/kpi`,
        { token: auth },
    )
    assert.equal(forbidden.status, 404)
})

test('data isolation blocks admin routes for user-facing accounts even when a restaurant exists', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }
                return null
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const listBatches = await request(
        server,
        'GET',
        `/api/admin/review-batches?restaurantId=${RESTAURANT_B}`,
        { token: auth },
    )
    assert.equal(listBatches.status, 403)

    const deleteBatch = await request(
        server,
        'DELETE',
        `/api/admin/review-batches/${BATCH_ID}`,
        { token: auth },
    )
    assert.equal(deleteBatch.status, 403)
})

test('data isolation keeps user restaurant reads separate from admin-only surfaces', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'USER', tokenVersion: 0 }
                }
                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_A) {
                    return {
                        restaurant: {
                            id: RESTAURANT_A,
                            name: 'Alpha',
                            slug: 'alpha',
                            address: null,
                            googleMapUrl: null,
                            createdAt: new Date('2026-03-01T00:00:00Z'),
                            updatedAt: new Date('2026-03-01T00:00:00Z'),
                            insight: {
                                totalReviews: 1,
                                averageRating: 5,
                                positivePercentage: 100,
                                neutralPercentage: 0,
                                negativePercentage: 0,
                            },
                        },
                    }
                }

                return null
            },
        },
        complaintKeyword: {
            findFirst: async () => null,
        },
        review: {
            groupBy: async () => [],
            count: async () => 0,
        },
        $queryRaw: async () => [],
        reviewIntakeBatch: {
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const userRead = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_A}/dashboard/kpi`,
        { token: auth },
    )
    assert.equal(userRead.status, 200)

    const adminForbidden = await request(
        server,
        'GET',
        `/api/admin/review-batches?restaurantId=${RESTAURANT_A}`,
        { token: auth },
    )
    assert.equal(adminForbidden.status, 403)
})

test('data isolation allows internal admin routes without restaurant membership', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'ADMIN', tokenVersion: 0 }
                }
                return null
            },
        },
        restaurant: {
            findUnique: async ({ where }) => {
                if (where.id === RESTAURANT_A) {
                    return {
                        id: RESTAURANT_A,
                        name: 'Alpha',
                        slug: 'alpha',
                        address: null,
                        googleMapUrl: null,
                        createdAt: new Date('2026-03-01T00:00:00Z'),
                        updatedAt: new Date('2026-03-01T00:00:00Z'),
                    }
                }

                return null
            },
        },
        reviewIntakeBatch: {
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const listBatches = await request(
        server,
        'GET',
        `/api/admin/review-batches?restaurantId=${RESTAURANT_A}`,
        { token: auth },
    )
    assert.equal(listBatches.status, 200)
    assert.deepEqual(listBatches.body.data, [])
})

test('data isolation blocks admin users from user-facing restaurant routes', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', role: 'ADMIN', tokenVersion: 0 }
                }
                return null
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const userRoute = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_A}/dashboard/kpi`,
        { token: auth },
    )

    assert.equal(userRoute.status, 403)
})
