const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

test('dashboard endpoints return data with valid access', async (t) => {
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
                if (where.userId === 'user-1' && where.restaurantId === 'restaurant-1') {
                    return {
                        permission: 'OWNER',
                        restaurant: {
                            id: 'restaurant-1',
                            name: 'Cafe One',
                            slug: 'cafe-one',
                            address: null,
                            googleMapUrl: null,
                            createdAt: new Date('2026-03-01T00:00:00Z'),
                            updatedAt: new Date('2026-03-01T00:00:00Z'),
                            insight: {
                                totalReviews: 5,
                                averageRating: 4.2,
                                positivePercentage: 60,
                                neutralPercentage: 20,
                                negativePercentage: 20,
                            },
                        },
                    }
                }

                return null
            },
        },
        review: {
            findMany: async ({ select }) => {
                if (select?.sentiment) {
                    return [
                        { sentiment: 'POSITIVE' },
                        { sentiment: 'NEGATIVE' },
                        { sentiment: 'POSITIVE' },
                    ]
                }

                return [
                    {
                        rating: 4,
                        reviewDate: new Date('2026-03-01T00:00:00Z'),
                        createdAt: new Date('2026-03-01T00:00:00Z'),
                    },
                ]
            },
        },
        complaintKeyword: {
            findMany: async () => [
                { keyword: 'slow service', count: 3, percentage: 60 },
            ],
            findFirst: async () => ({
                keyword: 'slow service',
                count: 3,
                percentage: 60,
                lastUpdatedAt: new Date('2026-03-02T00:00:00Z'),
            }),
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })

    const kpi = await request(server, 'GET', '/api/restaurants/restaurant-1/dashboard/kpi', {
        token: auth,
    })
    assert.equal(kpi.status, 200)
    assert.equal(kpi.body.data.totalReviews, 5)

    const sentiment = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-1/dashboard/sentiment',
        { token: auth },
    )
    assert.equal(sentiment.status, 200)

    const trend = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-1/dashboard/trend',
        { token: auth },
    )
    assert.equal(trend.status, 200)

    const complaints = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-1/dashboard/complaints',
        { token: auth },
    )
    assert.equal(complaints.status, 200)

    const topIssue = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-1/dashboard/top-issue',
        { token: auth },
    )
    assert.equal(topIssue.status, 200)
    assert.equal(topIssue.body.data.keyword, 'slow service')
})

test('dashboard endpoints reject missing auth and unauthorized access', async (t) => {
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
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const missingAuth = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-1/dashboard/kpi',
    )
    assert.equal(missingAuth.status, 401)

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })
    const forbidden = await request(
        server,
        'GET',
        '/api/restaurants/restaurant-1/dashboard/kpi',
        { token: auth },
    )
    assert.equal(forbidden.status, 404)
})
