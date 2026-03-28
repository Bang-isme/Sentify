const test = require('node:test')
const assert = require('node:assert/strict')

const { createTestToken, request, startApp, stopApp } = require('./test-helpers')

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001'
const SUBMISSION_ID = '00000000-0000-0000-0000-000000000111'

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
        restaurantSourceSubmission: {
            findMany: async () => [],
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
            entitlement: {
                id: null,
                restaurantId: RESTAURANT_ID,
                planTier: 'FREE',
                createdAt: null,
                updatedAt: null,
                effectivePolicy: {
                    planTier: 'FREE',
                    sourceSubmissionLane: 'STANDARD',
                    sourceSyncIntervalMinutes: 1440,
                    actionCardsLimit: 1,
                    prioritySync: false,
                    processingClass: 'STANDARD_QUEUE',
                },
            },
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
    assert.equal(detailResponse.body.data.restaurant.entitlement.planTier, 'FREE')
    assert.equal(detailResponse.body.data.userFlow.datasetStatus.pendingBatchCount, 1)
    assert.equal(detailResponse.body.data.adminFlow.sourceStats.activeCount, 1)
    assert.equal(detailResponse.body.data.adminFlow.latestRun.status, 'PARTIAL')
    assert.equal(detailResponse.body.data.adminFlow.sourceSubmissionQueue.summary.totalSubmissions, 0)
    assert.equal(detailResponse.body.data.adminFlow.sourceSubmissionQueue.item, null)
    assert.ok(Array.isArray(detailResponse.body.data.adminFlow.nextActions))
})

test('admin source-submission queue endpoint groups actionable submissions by canonical place identity', async (t) => {
    const otherRestaurantId = '00000000-0000-0000-0000-000000000002'
    const submittedAt = new Date('2026-03-11T00:00:00Z')

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'admin-1') {
                    return { id: 'admin-1', role: 'ADMIN', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findMany: async () => [
                {
                    id: 'submission-1',
                    restaurantId: RESTAURANT_ID,
                    inputUrl: 'https://maps.app.goo.gl/cafe-one',
                    normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
                    canonicalCid: '4548797685071303380',
                    placeName: 'Cafe One',
                    googlePlaceId: 'place-1',
                    placeHexId: '0x123:0x456',
                    dedupeKey: 'cid:4548797685071303380',
                    schedulingLane: 'STANDARD',
                    recommendationCode: 'REUSE_SHARED_IDENTITY',
                    recommendationMessage: 'Known canonical place.',
                    linkedSourceId: null,
                    submittedAt,
                    lastResolvedAt: submittedAt,
                    restaurant: {
                        id: RESTAURANT_ID,
                        name: 'Cafe One',
                        slug: 'cafe-one',
                        googleMapUrl: 'https://maps.app.goo.gl/cafe-one',
                    },
                },
                {
                    id: 'submission-2',
                    restaurantId: otherRestaurantId,
                    inputUrl: 'https://maps.app.goo.gl/cafe-two',
                    normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
                    canonicalCid: '4548797685071303380',
                    placeName: 'Cafe One',
                    googlePlaceId: 'place-1',
                    placeHexId: '0x123:0x456',
                    dedupeKey: 'cid:4548797685071303380',
                    schedulingLane: 'STANDARD',
                    recommendationCode: 'REUSE_SHARED_IDENTITY',
                    recommendationMessage: 'Known canonical place.',
                    linkedSourceId: null,
                    submittedAt: new Date('2026-03-12T00:00:00Z'),
                    lastResolvedAt: new Date('2026-03-12T00:00:00Z'),
                    restaurant: {
                        id: otherRestaurantId,
                        name: 'Cafe Two',
                        slug: 'cafe-two',
                        googleMapUrl: 'https://maps.app.goo.gl/cafe-two',
                    },
                },
            ],
        },
        reviewCrawlSource: {
            findMany: async () => [
                {
                    id: 'source-shared',
                    restaurantId: '00000000-0000-0000-0000-000000000003',
                    canonicalCid: '4548797685071303380',
                    inputUrl: 'https://maps.app.goo.gl/shared-cafe',
                    status: 'ACTIVE',
                    syncEnabled: true,
                },
            ],
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })

    const response = await request(server, 'GET', '/api/admin/restaurants/source-submissions', {
        token: auth,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.summary.totalSubmissions, 2)
    assert.equal(response.body.data.summary.actionableCount, 2)
    assert.equal(response.body.data.summary.dedupedGroupCount, 1)
    assert.equal(response.body.data.summary.reuseSharedIdentityCount, 2)
    assert.equal(response.body.data.summary.priorityLaneCount, 0)
    assert.equal(response.body.data.groups.length, 1)
    assert.equal(response.body.data.groups[0].groupKey, 'cid:4548797685071303380')
    assert.equal(response.body.data.groups[0].queueState, 'REUSE_SHARED_IDENTITY')
    assert.equal(response.body.data.groups[0].schedulingLane, 'STANDARD')
    assert.equal(response.body.data.groups[0].restaurantCount, 2)
    assert.equal(response.body.data.groups[0].canonicalIdentity.canonicalCid, '4548797685071303380')
    assert.equal(response.body.data.groups[0].restaurants[0].restaurantId, RESTAURANT_ID)
    assert.equal(response.body.data.groups[0].restaurants[0].dedupeKey, 'cid:4548797685071303380')
    assert.equal(response.body.data.groups[0].restaurants[0].schedulingLane, 'STANDARD')
})

test('admin can update restaurant entitlement and re-align entitlement-default submission lanes', async (t) => {
    const auditEvents = []
    let updateManyArgs = null

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
                    entitlement: {
                        id: 'restaurant-entitlement-1',
                        restaurantId: RESTAURANT_ID,
                        planTier: 'FREE',
                        createdAt: new Date('2026-03-01T00:00:00Z'),
                        updatedAt: new Date('2026-03-10T00:00:00Z'),
                    },
                }
            },
        },
        restaurantEntitlement: {
            upsert: async ({ update }) => ({
                id: 'restaurant-entitlement-1',
                restaurantId: RESTAURANT_ID,
                planTier: update.planTier,
                createdAt: new Date('2026-03-01T00:00:00Z'),
                updatedAt: new Date('2026-03-27T06:20:00Z'),
            }),
        },
        restaurantSourceSubmission: {
            updateMany: async (args) => {
                updateManyArgs = args
                return { count: 1 }
            },
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: new Date('2026-03-27T06:20:00Z'),
                }
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })
    const response = await request(
        server,
        'PATCH',
        `/api/admin/restaurants/${RESTAURANT_ID}/entitlement`,
        {
            token: auth,
            body: {
                planTier: 'PREMIUM',
            },
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.restaurantId, RESTAURANT_ID)
    assert.equal(response.body.data.entitlement.planTier, 'PREMIUM')
    assert.equal(
        response.body.data.entitlement.effectivePolicy.sourceSubmissionLane,
        'PRIORITY',
    )
    assert.deepEqual(updateManyArgs, {
        where: {
            restaurantId: RESTAURANT_ID,
            schedulingLaneSource: 'ENTITLEMENT_DEFAULT',
        },
        data: {
            schedulingLane: 'PRIORITY',
        },
    })
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'ADMIN_RESTAURANT_ENTITLEMENT_UPDATED')
})

test('admin can resolve a pending merchant source submission into a canonical place identity', async (t) => {
    const auditEvents = []
    let persistedSubmission = {
        id: SUBMISSION_ID,
        restaurantId: RESTAURANT_ID,
        submittedByUserId: 'user-1',
        linkedSourceId: null,
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/the59',
        normalizedUrl: null,
        canonicalCid: null,
        placeHexId: null,
        googlePlaceId: null,
        placeName: null,
        dedupeKey: 'url:https://maps.app.goo.gl/the59',
        status: 'PENDING_IDENTITY_RESOLUTION',
        schedulingLane: 'STANDARD',
        recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
        recommendationMessage: 'Waiting for admin resolution.',
        submittedAt: new Date('2026-03-25T10:05:00Z'),
        lastResolvedAt: null,
        createdAt: new Date('2026-03-25T10:05:00Z'),
        updatedAt: new Date('2026-03-25T10:05:00Z'),
        restaurant: {
            id: RESTAURANT_ID,
            name: 'Cafe One',
            slug: 'cafe-one',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    }

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'admin-1') {
                    return { id: 'admin-1', role: 'ADMIN', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findUnique: async ({ where }) => {
                if (where.id === SUBMISSION_ID) {
                    return persistedSubmission
                }

                return null
            },
            update: async ({ where, data }) => {
                assert.equal(where.id, SUBMISSION_ID)
                persistedSubmission = {
                    ...persistedSubmission,
                    ...data,
                    updatedAt: new Date('2026-03-27T06:00:00Z'),
                }
                return persistedSubmission
            },
        },
        reviewCrawlSource: {
            findUnique: async () => null,
            findMany: async () => [],
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: new Date('2026-03-27T06:00:00Z'),
                }
            },
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: {
            '../src/modules/review-crawl/google-maps.service': {
                resolveGoogleMapsSource: async () => ({
                    source: {
                        resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
                    },
                    place: {
                        name: 'Cafe One',
                        identifiers: {
                            cid: '4548797685071303380',
                            googlePlaceId: 'place-1',
                            placeHexId: '0x123:0x456',
                        },
                    },
                }),
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })
    const response = await request(
        server,
        'POST',
        `/api/admin/restaurants/source-submissions/${SUBMISSION_ID}/resolve`,
        {
            token: auth,
            body: {},
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.submission.id, SUBMISSION_ID)
    assert.equal(response.body.data.submission.status, 'READY_FOR_SOURCE_LINK')
    assert.equal(response.body.data.submission.canonicalCid, '4548797685071303380')
    assert.equal(response.body.data.submission.dedupeKey, 'cid:4548797685071303380')
    assert.equal(response.body.data.submission.placeName, 'Cafe One')
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'ADMIN_SOURCE_SUBMISSION_RESOLVED')
    assert.equal(
        auditEvents[0].metadataJson.sourceSubmissionSnapshot.canonicalCid,
        '4548797685071303380',
    )
})

test('admin can create and link a crawl source from a resolved submission without re-calling Google', async (t) => {
    const auditEvents = []
    let persistedSubmission = {
        id: SUBMISSION_ID,
        restaurantId: RESTAURANT_ID,
        submittedByUserId: 'user-1',
        linkedSourceId: null,
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/the59',
        normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
        canonicalCid: '4548797685071303380',
        placeHexId: '0x123:0x456',
        googlePlaceId: 'place-1',
        placeName: 'Cafe One',
        dedupeKey: 'cid:4548797685071303380',
        status: 'READY_FOR_SOURCE_LINK',
        schedulingLane: 'STANDARD',
        recommendationCode: 'REUSE_SHARED_IDENTITY',
        recommendationMessage: 'Known canonical place.',
        submittedAt: new Date('2026-03-25T10:05:00Z'),
        lastResolvedAt: new Date('2026-03-25T10:06:00Z'),
        createdAt: new Date('2026-03-25T10:05:00Z'),
        updatedAt: new Date('2026-03-25T10:06:00Z'),
        restaurant: {
            id: RESTAURANT_ID,
            name: 'Cafe One',
            slug: 'cafe-one',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    }

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
            findUnique: async ({ where }) => {
                if (where.id === RESTAURANT_ID) {
                    return {
                        id: RESTAURANT_ID,
                        name: 'Cafe One',
                        slug: 'cafe-one',
                        address: '1 Demo Street',
                        googleMapUrl: 'https://maps.app.goo.gl/the59',
                        createdAt: new Date('2026-03-01T00:00:00Z'),
                        updatedAt: new Date('2026-03-10T00:00:00Z'),
                    }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findUnique: async ({ where }) => {
                if (where.id === SUBMISSION_ID) {
                    return persistedSubmission
                }

                return null
            },
            update: async ({ where, data }) => {
                assert.equal(where.id, SUBMISSION_ID)
                persistedSubmission = {
                    ...persistedSubmission,
                    ...data,
                    updatedAt: new Date('2026-03-27T06:10:00Z'),
                }
                return persistedSubmission
            },
        },
        reviewCrawlSource: {
            findUnique: async ({ where }) => {
                if (where?.restaurantId_provider_canonicalCid) {
                    return null
                }

                return null
            },
            upsert: async ({ create }) => ({
                id: 'source-1',
                restaurantId: create.restaurantId,
                provider: create.provider,
                status: 'ACTIVE',
                inputUrl: create.inputUrl,
                resolvedUrl: create.resolvedUrl,
                canonicalCid: create.canonicalCid,
                placeHexId: create.placeHexId,
                googlePlaceId: create.googlePlaceId,
                placeName: create.placeName,
                language: create.language,
                region: create.region,
                syncEnabled: create.syncEnabled,
                syncIntervalMinutes: create.syncIntervalMinutes,
                lastReportedTotal: create.lastReportedTotal,
                nextScheduledAt: new Date('2026-03-28T06:10:00Z'),
                lastSyncedAt: null,
                lastSuccessfulRunAt: null,
                createdAt: new Date('2026-03-27T06:10:00Z'),
                updatedAt: new Date('2026-03-27T06:10:00Z'),
            }),
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: new Date('2026-03-27T06:10:00Z'),
                }
            },
        },
    }

    const { server } = await startApp(prismaOverrides, {
        moduleOverrides: {
            '../src/modules/review-crawl/google-maps.service': {
                resolveGoogleMapsSource: async () => {
                    throw new Error('resolveGoogleMapsSource should not be called')
                },
            },
        },
    })

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })
    const response = await request(
        server,
        'POST',
        `/api/admin/restaurants/source-submissions/${SUBMISSION_ID}/create-source`,
        {
            token: auth,
            body: {
                syncEnabled: true,
                syncIntervalMinutes: 360,
            },
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.submission.status, 'LINKED_TO_SOURCE')
    assert.equal(response.body.data.submission.linkedSourceId, 'source-1')
    assert.equal(response.body.data.submission.dedupeKey, 'cid:4548797685071303380')
    assert.equal(response.body.data.source.id, 'source-1')
    assert.equal(response.body.data.source.syncIntervalMinutes, 360)
    assert.deepEqual(
        auditEvents.map((event) => event.action),
        ['CRAWL_SOURCE_CREATED', 'ADMIN_SOURCE_SUBMISSION_LINKED'],
    )
    assert.equal(
        auditEvents[1].metadataJson.sourceSubmissionSnapshot.linkedSourceId,
        'source-1',
    )
})

test('admin can move a merchant source submission into the priority scheduling lane', async (t) => {
    const auditEvents = []
    let persistedSubmission = {
        id: SUBMISSION_ID,
        restaurantId: RESTAURANT_ID,
        submittedByUserId: 'user-1',
        linkedSourceId: null,
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/the59',
        normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
        canonicalCid: '4548797685071303380',
        placeHexId: '0x123:0x456',
        googlePlaceId: 'place-1',
        placeName: 'Cafe One',
        dedupeKey: 'cid:4548797685071303380',
        status: 'READY_FOR_SOURCE_LINK',
        schedulingLane: 'STANDARD',
        recommendationCode: 'REUSE_SHARED_IDENTITY',
        recommendationMessage: 'Known canonical place.',
        submittedAt: new Date('2026-03-25T10:05:00Z'),
        lastResolvedAt: new Date('2026-03-25T10:06:00Z'),
        createdAt: new Date('2026-03-25T10:05:00Z'),
        updatedAt: new Date('2026-03-25T10:06:00Z'),
        restaurant: {
            id: RESTAURANT_ID,
            name: 'Cafe One',
            slug: 'cafe-one',
            googleMapUrl: 'https://maps.app.goo.gl/the59',
        },
    }

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'admin-1') {
                    return { id: 'admin-1', role: 'ADMIN', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findUnique: async ({ where }) => {
                if (where.id === SUBMISSION_ID) {
                    return persistedSubmission
                }

                return null
            },
            update: async ({ where, data }) => {
                assert.equal(where.id, SUBMISSION_ID)
                persistedSubmission = {
                    ...persistedSubmission,
                    ...data,
                    updatedAt: new Date('2026-03-27T06:15:00Z'),
                }
                return persistedSubmission
            },
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: new Date('2026-03-27T06:15:00Z'),
                }
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })
    const response = await request(
        server,
        'POST',
        `/api/admin/restaurants/source-submissions/${SUBMISSION_ID}/scheduling-lane`,
        {
            token: auth,
            body: {
                schedulingLane: 'PRIORITY',
            },
        },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.submission.id, SUBMISSION_ID)
    assert.equal(response.body.data.submission.schedulingLane, 'PRIORITY')
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'ADMIN_SOURCE_SUBMISSION_SCHEDULING_LANE_UPDATED')
})

test('admin can claim the next deduped merchant source-submission group by lane and skip active leases', async (t) => {
    const auditEvents = []
    const submissions = [
        {
            id: 'submission-priority-1',
            restaurantId: RESTAURANT_ID,
            submittedByUserId: 'user-1',
            linkedSourceId: null,
            provider: 'GOOGLE_MAPS',
            inputUrl: 'https://maps.app.goo.gl/priority-1',
            normalizedUrl: 'https://www.google.com/maps?cid=cid-priority&hl=en&gl=US',
            canonicalCid: 'cid-priority',
            placeHexId: '0x123:0x456',
            googlePlaceId: 'place-priority',
            placeName: 'Priority Place',
            dedupeKey: 'cid:cid-priority',
            status: 'READY_FOR_SOURCE_LINK',
            schedulingLane: 'PRIORITY',
            recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
            recommendationMessage: 'Priority lane.',
            submittedAt: new Date('2026-03-25T08:00:00Z'),
            lastResolvedAt: new Date('2026-03-25T08:05:00Z'),
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            createdAt: new Date('2026-03-25T08:00:00Z'),
            updatedAt: new Date('2026-03-25T08:05:00Z'),
            restaurant: {
                id: RESTAURANT_ID,
                name: 'Cafe One',
                slug: 'cafe-one',
                googleMapUrl: 'https://maps.app.goo.gl/priority-1',
            },
        },
        {
            id: 'submission-priority-2',
            restaurantId: '00000000-0000-0000-0000-000000000002',
            submittedByUserId: 'user-2',
            linkedSourceId: null,
            provider: 'GOOGLE_MAPS',
            inputUrl: 'https://maps.app.goo.gl/priority-2',
            normalizedUrl: 'https://www.google.com/maps?cid=cid-priority&hl=en&gl=US',
            canonicalCid: 'cid-priority',
            placeHexId: '0x123:0x456',
            googlePlaceId: 'place-priority',
            placeName: 'Priority Place',
            dedupeKey: 'cid:cid-priority',
            status: 'READY_FOR_SOURCE_LINK',
            schedulingLane: 'PRIORITY',
            recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
            recommendationMessage: 'Priority lane.',
            submittedAt: new Date('2026-03-25T08:10:00Z'),
            lastResolvedAt: new Date('2026-03-25T08:15:00Z'),
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            createdAt: new Date('2026-03-25T08:10:00Z'),
            updatedAt: new Date('2026-03-25T08:15:00Z'),
            restaurant: {
                id: '00000000-0000-0000-0000-000000000002',
                name: 'Cafe Two',
                slug: 'cafe-two',
                googleMapUrl: 'https://maps.app.goo.gl/priority-2',
            },
        },
        {
            id: 'submission-standard-1',
            restaurantId: '00000000-0000-0000-0000-000000000003',
            submittedByUserId: 'user-3',
            linkedSourceId: null,
            provider: 'GOOGLE_MAPS',
            inputUrl: 'https://maps.app.goo.gl/standard-1',
            normalizedUrl: 'https://www.google.com/maps?cid=cid-standard&hl=en&gl=US',
            canonicalCid: 'cid-standard',
            placeHexId: '0x789:0xabc',
            googlePlaceId: 'place-standard',
            placeName: 'Standard Place',
            dedupeKey: 'cid:cid-standard',
            status: 'READY_FOR_SOURCE_LINK',
            schedulingLane: 'STANDARD',
            recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
            recommendationMessage: 'Standard lane.',
            submittedAt: new Date('2026-03-25T09:00:00Z'),
            lastResolvedAt: new Date('2026-03-25T09:05:00Z'),
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            createdAt: new Date('2026-03-25T09:00:00Z'),
            updatedAt: new Date('2026-03-25T09:05:00Z'),
            restaurant: {
                id: '00000000-0000-0000-0000-000000000003',
                name: 'Cafe Three',
                slug: 'cafe-three',
                googleMapUrl: 'https://maps.app.goo.gl/standard-1',
            },
        },
    ]

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'admin-1') {
                    return { id: 'admin-1', role: 'ADMIN', tokenVersion: 0 }
                }

                return null
            },
        },
        restaurantSourceSubmission: {
            findMany: async () => submissions,
            updateMany: async ({ where, data }) => {
                const matching = submissions.filter((submission) => {
                    if (submission.provider !== where.provider) {
                        return false
                    }

                    if (!where.status?.in?.includes(submission.status)) {
                        return false
                    }

                    if (submission.dedupeKey !== where.dedupeKey) {
                        return false
                    }

                    const leaseExpired =
                        submission.claimExpiresAt === null ||
                        submission.claimExpiresAt.getTime() <= new Date(where.OR[1].claimExpiresAt.lte).getTime()

                    return leaseExpired
                })

                for (const submission of matching) {
                    Object.assign(submission, data, {
                        updatedAt: new Date('2026-03-27T06:20:00Z'),
                    })
                }

                return {
                    count: matching.length,
                }
            },
        },
        reviewCrawlSource: {
            findMany: async () => [],
        },
        auditEvent: {
            create: async ({ data }) => {
                auditEvents.push(data)
                return {
                    id: `audit-${auditEvents.length}`,
                    ...data,
                    createdAt: new Date('2026-03-27T06:20:00Z'),
                }
            },
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const auth = createTestToken({ userId: 'admin-1', tokenVersion: 0 })

    const firstResponse = await request(
        server,
        'POST',
        '/api/admin/restaurants/source-submissions/claim-next',
        {
            token: auth,
            body: {
                leaseMinutes: 20,
            },
        },
    )

    assert.equal(firstResponse.status, 200)
    assert.equal(firstResponse.body.data.group.groupKey, 'cid:cid-priority')
    assert.equal(firstResponse.body.data.group.schedulingLane, 'PRIORITY')
    assert.equal(firstResponse.body.data.group.restaurants.length, 2)
    assert.equal(firstResponse.body.data.group.claim.claimedByUserId, 'admin-1')
    assert.equal(firstResponse.body.data.group.claim.isActive, true)

    const secondResponse = await request(
        server,
        'POST',
        '/api/admin/restaurants/source-submissions/claim-next',
        {
            token: auth,
            body: {
                leaseMinutes: 20,
            },
        },
    )

    assert.equal(secondResponse.status, 200)
    assert.equal(secondResponse.body.data.group.groupKey, 'cid:cid-standard')
    assert.equal(secondResponse.body.data.group.schedulingLane, 'STANDARD')
    assert.equal(secondResponse.body.data.group.claim.claimedByUserId, 'admin-1')
    assert.equal(secondResponse.body.data.group.claim.isActive, true)

    const thirdResponse = await request(
        server,
        'POST',
        '/api/admin/restaurants/source-submissions/claim-next',
        {
            token: auth,
            body: {
                leaseMinutes: 20,
            },
        },
    )

    assert.equal(thirdResponse.status, 200)
    assert.equal(thirdResponse.body.data.group, null)
    assert.deepEqual(
        auditEvents.map((event) => event.action),
        ['ADMIN_SOURCE_SUBMISSION_GROUP_CLAIMED', 'ADMIN_SOURCE_SUBMISSION_GROUP_CLAIMED'],
    )
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

