const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

test('data isolation blocks cross-restaurant access', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', tokenVersion: 0 }
                }
                return null
            },
        },
        restaurantUser: {
            findFirst: async ({ where }) => {
                if (where.userId === 'user-1' && where.restaurantId === 'restaurant-a') {
                    return {
                        permission: 'OWNER',
                        restaurant: {
                            id: 'restaurant-a',
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
            findMany: async () => [],
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const allowed = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-a/dashboard/kpi',
        { token: auth },
    )
    assert.equal(allowed.status, 200)

    const forbidden = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-b/dashboard/kpi',
        { token: auth },
    )
    assert.equal(forbidden.status, 404)
})

test('data isolation blocks admin routes for non-members', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return { id: 'user-1', tokenVersion: 0 }
                }
                return null
            },
        },
        restaurantUser: {
            findFirst: async () => null,
        },
        reviewIntakeBatch: {
            findUnique: async () => ({
                id: 'batch-1',
                restaurantId: 'restaurant-b',
                status: 'DRAFT',
                items: [],
            }),
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
        '/api/admin/review-batches?restaurantId=restaurant-b',
        { token: auth },
    )
    assert.equal(listBatches.status, 404)

    const deleteBatch = await request(
        server,
        'DELETE',
        '/api/admin/review-batches/batch-1',
        { token: auth },
    )
    assert.equal(deleteBatch.status, 404)
})
