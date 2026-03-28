const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001'

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
                if (where.userId === 'user-1' && where.restaurantId === RESTAURANT_ID) {
                    return {
                        restaurant: {
                            id: RESTAURANT_ID,
                            name: 'Cafe One',
                            slug: 'cafe-one',
                            address: null,
                            googleMapUrl: 'https://maps.app.goo.gl/demo-place',
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
            groupBy: async () => [
                { sentiment: 'POSITIVE', _count: { _all: 2 } },
                { sentiment: 'NEGATIVE', _count: { _all: 1 } },
            ],
            count: async () => 5,
            findMany: async () => [
                {
                    id: 'review-1',
                    authorName: 'Minh',
                    rating: 2,
                    sentiment: 'NEGATIVE',
                    content: 'Slow service again during dinner rush.',
                    reviewDate: new Date('2026-03-02T00:00:00Z'),
                    createdAt: new Date('2026-03-02T00:00:00Z'),
                    keywords: ['slow service'],
                },
            ],
        },
        $queryRaw: async () => [
            {
                bucket: new Date('2026-03-01T00:00:00Z'),
                averageRating: 4.0,
                reviewCount: 1,
            },
        ],
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

    const kpi = await request(server, 'GET', `/api/restaurants/${RESTAURANT_ID}/dashboard/kpi`, {
        token: auth,
    })
    assert.equal(kpi.status, 200)
    assert.equal(kpi.body.data.totalReviews, 5)

    const sentiment = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/sentiment`,
        { token: auth },
    )
    assert.equal(sentiment.status, 200)

    const trend = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/trend`,
        { token: auth },
    )
    assert.equal(trend.status, 200)

    const complaints = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/complaints`,
        { token: auth },
    )
    assert.equal(complaints.status, 200)

    const topIssue = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/top-issue`,
        { token: auth },
    )
    assert.equal(topIssue.status, 200)
    assert.equal(topIssue.body.data.keyword, 'slow service')

    const actions = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/actions`,
        { token: auth },
    )
    assert.equal(actions.status, 200)
    assert.equal(actions.body.data.summary.state, 'ACTIONABLE_NOW')
    assert.equal(actions.body.data.topIssue.keyword, 'slow service')
    assert.equal(actions.body.data.actionCards[0].recommendationCode, 'FIX_RESPONSE_TIME')
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
        `/api/restaurants/${RESTAURANT_ID}/dashboard/kpi`,
    )
    assert.equal(missingAuth.status, 401)

    const auth = createTestToken({ userId: 'user-1', tokenVersion: 0 })
    const forbidden = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/kpi`,
        { token: auth },
    )
    assert.equal(forbidden.status, 404)

    const forbiddenActions = await request(
        server,
        'GET',
        `/api/restaurants/${RESTAURANT_ID}/dashboard/actions`,
        { token: auth },
    )
    assert.equal(forbiddenActions.status, 404)
})
