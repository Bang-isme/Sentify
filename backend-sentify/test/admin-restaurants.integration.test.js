const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001'

test('admin restaurant endpoints expose control-plane selection and overview data', async (t) => {
    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'admin-1') {
                    return { id: 'admin-1', role: 'ADMIN', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurant: {
            findMany: async () => [
                {
                    id: RESTAURANT_ID,
                    name: 'Cafe One',
                    slug: 'cafe-one',
                    address: '1 Demo Street',
                    googleMapUrl: 'https://maps.app.goo.gl/demo',
                    createdAt: new Date('2026-03-01T00:00:00Z'),
                    updatedAt: new Date('2026-03-10T00:00:00Z'),
                    insight: {
                        totalReviews: 5,
                        averageRating: 4.2,
                        positivePercentage: 60,
                        neutralPercentage: 20,
                        negativePercentage: 20,
                    },
                    _count: {
                        reviews: 5,
                        users: 2,
                    },
                },
            ],
            findUnique: async ({ where }) => {
                if (where.id !== RESTAURANT_ID) {
                    return null
                }

                return {
                    id: RESTAURANT_ID,
                    name: 'Cafe One',
                    slug: 'cafe-one',
                    address: '1 Demo Street',
                    googleMapUrl: 'https://maps.app.goo.gl/demo',
                    createdAt: new Date('2026-03-01T00:00:00Z'),
                    updatedAt: new Date('2026-03-10T00:00:00Z'),
                    insight: {
                        totalReviews: 5,
                        averageRating: 4.2,
                        positivePercentage: 60,
                        neutralPercentage: 20,
                        negativePercentage: 20,
                    },
                    _count: {
                        reviews: 5,
                        users: 2,
                    },
                }
            },
        },
        reviewIntakeBatch: {
            groupBy: async () => [{ restaurantId: RESTAURANT_ID, _count: { _all: 1 } }],
            findFirst: async ({ where }) => {
                if (where.restaurantId === RESTAURANT_ID && where.status === 'PUBLISHED') {
                    return {
                        sourceType: 'MANUAL',
                        publishedAt: new Date('2026-03-08T00:00:00Z'),
                    }
                }

                return null
            },
            findMany: async ({ where }) => {
                if (where.restaurantId !== RESTAURANT_ID) {
                    return []
                }

                return [
                    {
                        id: 'batch-1',
                        status: 'DRAFT',
                        title: 'Pending curation',
                        sourceType: 'GOOGLE_MAPS_CRAWL',
                        createdAt: new Date('2026-03-09T00:00:00Z'),
                        updatedAt: new Date('2026-03-10T00:00:00Z'),
                        items: [
                            { approvalStatus: 'PENDING' },
                            { approvalStatus: 'APPROVED' },
                        ],
                    },
                ]
            },
        },
        reviewIntakeItem: {
            groupBy: async () => [
                { approvalStatus: 'PENDING', _count: { _all: 1 } },
                { approvalStatus: 'APPROVED', _count: { _all: 1 } },
            ],
        },
        reviewCrawlSource: {
            groupBy: async () => [{ restaurantId: RESTAURANT_ID, _count: { _all: 1 } }],
            count: async ({ where }) => {
                if (where?.status === 'ACTIVE') {
                    return 1
                }

                if (where?.status === 'DISABLED') {
                    return 0
                }

                return 1
            },
        },
        reviewCrawlRun: {
            findFirst: async () => ({
                id: 'run-1',
                sourceId: 'source-1',
                intakeBatchId: 'batch-1',
                status: 'PARTIAL',
                strategy: 'BACKFILL',
                priority: 'NORMAL',
                extractedCount: 20,
                validCount: 18,
                warningCount: 1,
                createdAt: new Date('2026-03-10T00:00:00Z'),
                startedAt: new Date('2026-03-10T00:00:05Z'),
                finishedAt: new Date('2026-03-10T00:02:00Z'),
            }),
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })

    const listResponse = await request(server, 'GET', '/api/admin/restaurants', {
        token: auth,
    })
    assert.equal(listResponse.status, 200)
    assert.deepEqual(listResponse.body.data, [
        {
            id: RESTAURANT_ID,
            name: 'Cafe One',
            slug: 'cafe-one',
            address: '1 Demo Street',
            googleMapUrl: 'https://maps.app.goo.gl/demo',
            totalReviews: 5,
            memberCount: 2,
            pendingBatchCount: 1,
            activeSourceCount: 1,
            insightSummary: {
                totalReviews: 5,
                averageRating: 4.2,
                positivePercentage: 60,
                neutralPercentage: 20,
                negativePercentage: 20,
            },
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
        },
    ])

    const detailResponse = await request(
        server,
        'GET',
        `/api/admin/restaurants/${RESTAURANT_ID}`,
        { token: auth },
    )
    assert.equal(detailResponse.status, 200)
    assert.equal(detailResponse.body.data.restaurant.id, RESTAURANT_ID)
    assert.equal(detailResponse.body.data.restaurant.memberCount, 2)
    assert.equal(detailResponse.body.data.userFlow.datasetStatus.pendingBatchCount, 1)
    assert.equal(detailResponse.body.data.adminFlow.sourceStats.activeCount, 1)
    assert.equal(detailResponse.body.data.adminFlow.latestRun.status, 'PARTIAL')
    assert.ok(Array.isArray(detailResponse.body.data.adminFlow.nextActions))
})

test('admin restaurant endpoints stay hidden from non-admin users', async (t) => {
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

    const response = await request(server, 'GET', '/api/admin/restaurants', {
        token: auth,
    })
    assert.equal(response.status, 403)
})

