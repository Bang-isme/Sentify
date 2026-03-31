const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function withMock(modulePath, exports) {
    require.cache[require.resolve(modulePath)] = {
        id: require.resolve(modulePath),
        filename: require.resolve(modulePath),
        loaded: true,
        exports,
    }
}

function mockInternalOperatorAccess(onCall) {
    withMock('../src/services/user-access.service', {
        getUserRoleAccess: async (args) => {
            if (typeof onCall === 'function') {
                return onCall(args)
            }

            return {
                id: args.userId,
                role: 'ADMIN',
            }
        },
    })
}

function mockRestaurantLookup(onCall) {
    withMock('../src/services/restaurant-access.service', {
        ensureRestaurantExists: async (args) => {
            if (typeof onCall === 'function') {
                return onCall(args)
            }

            return {
                restaurant: {
                    id: args.restaurantId,
                },
            }
        },
    })
}

function mockPlatformControls(overrides = {}) {
    withMock('../src/services/platform-control.service', {
        assertPlatformControlEnabled: async () => ({
            crawlQueueWritesEnabled: true,
            crawlMaterializationEnabled: true,
            intakePublishEnabled: true,
            sourceSubmissionAutoBootstrapEnabled: true,
            sourceSubmissionAutoBootstrapMaxPerTick: 20,
        }),
        getPlatformControls: async () => ({
            crawlQueueWritesEnabled: true,
            crawlMaterializationEnabled: true,
            intakePublishEnabled: true,
            sourceSubmissionAutoBootstrapEnabled: true,
            sourceSubmissionAutoBootstrapMaxPerTick: 20,
        }),
        ...overrides,
    })
}

function mockAuditEvents(overrides = {}) {
    withMock('../src/services/audit-event.service', {
        appendAuditEvent: async () => null,
        appendAuditEvents: async () => ({ count: 0 }),
        ...overrides,
    })
}

function mockRestaurantStateService() {
    withMock('../src/services/restaurant-state.service', {
        PERSISTED_SOURCE_SUBMISSION_STATUS: {
            PENDING_IDENTITY_RESOLUTION: 'PENDING_IDENTITY_RESOLUTION',
            READY_FOR_SOURCE_LINK: 'READY_FOR_SOURCE_LINK',
            LINKED_TO_SOURCE: 'LINKED_TO_SOURCE',
        },
        SOURCE_SUBMISSION_SCHEDULING_LANE: {
            STANDARD: 'STANDARD',
            PRIORITY: 'PRIORITY',
        },
        SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION: {
            ALREADY_CONNECTED: 'ALREADY_CONNECTED',
        },
        buildSourceSubmissionAuditSnapshot: (submission) => ({
            submissionId: submission.id ?? null,
            inputUrl: submission.inputUrl ?? null,
            canonicalCid: submission.canonicalCid ?? null,
            linkedSourceId: submission.linkedSourceId ?? null,
            schedulingLane: submission.schedulingLane ?? null,
            schedulingLaneSource: submission.schedulingLaneSource ?? null,
            submittedAt: submission.submittedAt ?? null,
            lastResolvedAt: submission.lastResolvedAt ?? null,
        }),
    })
}

function mockPrisma(overrides = {}) {
    withMock('../src/lib/prisma', {
        restaurantEntitlement: {
            findUnique: async () => ({
                id: 'restaurant-entitlement-1',
                restaurantId: 'restaurant-1',
                planTier: 'FREE',
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            upsert: async ({ create, update = {} }) => ({
                id: 'restaurant-entitlement-1',
                ...create,
                ...update,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
        },
        restaurantSourceSubmission: {
            findMany: async () => [],
            updateMany: async () => ({ count: 0 }),
            update: async () => {
                throw new Error('Unexpected prisma.restaurantSourceSubmission.update call')
            },
        },
        ...overrides,
    })
}

function restoreModules() {
    clearModule('../src/modules/review-crawl/review-crawl.service')
    clearModule('../src/modules/review-crawl/review-crawl-source-submission-bootstrap.service')
    clearModule('../src/modules/review-crawl/review-crawl-source-persistence.service')
    clearModule('../src/modules/review-crawl/review-crawl-materialization.service')
    clearModule('../src/modules/review-crawl/review-crawl.repository')
    clearModule('../src/modules/review-crawl/review-crawl.queue')
    clearModule('../src/modules/review-crawl/review-crawl.runtime')
    clearModule('../src/modules/review-crawl/google-maps.service')
    clearModule('../src/services/platform-control.service')
    clearModule('../src/services/audit-event.service')
    clearModule('../src/services/restaurant-access.service')
    clearModule('../src/services/restaurant-entitlement.service')
    clearModule('../src/services/restaurant-state.service')
    clearModule('../src/services/user-access.service')
    clearModule('../src/modules/admin-intake/admin-intake.domain')
    clearModule('../src/modules/admin-intake/admin-intake.repository')
    clearModule('../src/lib/prisma')
    clearModule('../src/config/env')
    mockAuditEvents()
    mockRestaurantStateService()
    mockPrisma()
}

test('review crawl service upserts a canonical Google Maps source', async () => {
    restoreModules()

    process.env.REVIEW_CRAWL_SCHEDULER_INTERVAL_MS = '60000'

    let upsertArgs = null
    let auditEvent = null

    mockInternalOperatorAccess()
    mockRestaurantLookup()
    mockAuditEvents({
        appendAuditEvent: async (event) => {
            auditEvent = event
        },
    })
    withMock('../src/modules/review-crawl/google-maps.service', {
        resolveGoogleMapsSource: async () => ({
            place: {
                name: 'Quan Pho Hong',
                totalReviewCount: 4743,
                identifiers: {
                    cid: '4548797685071303380',
                    placeHexId: '0x314219004bcdcae5:0x3f209364ddcb52d4',
                    googlePlaceId: 'ChIJ5crNSwAZQjER1FLL3WSTID8',
                },
            },
            source: {
                resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            },
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findSourceByCanonicalIdentity: async () => null,
        upsertSourceByCanonicalIdentity: async (identity, createData, updateData) => {
            upsertArgs = { identity, createData, updateData }
            return {
                id: 'source-1',
                restaurantId: identity.restaurantId,
                provider: identity.provider,
                status: 'ACTIVE',
                inputUrl: createData.inputUrl,
                resolvedUrl: createData.resolvedUrl,
                canonicalCid: identity.canonicalCid,
                placeHexId: createData.placeHexId,
                googlePlaceId: createData.googlePlaceId,
                placeName: createData.placeName,
                language: createData.language,
                region: createData.region,
                syncEnabled: createData.syncEnabled,
                syncIntervalMinutes: createData.syncIntervalMinutes,
                lastReportedTotal: createData.lastReportedTotal,
                nextScheduledAt: createData.nextScheduledAt,
                lastSyncedAt: null,
                lastSuccessfulRunAt: null,
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:00:00Z'),
            }
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.upsertReviewCrawlSource({
        userId: 'user-1',
        input: {
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
        },
    })

    assert.equal(result.source.canonicalCid, '4548797685071303380')
    assert.equal(upsertArgs.identity.provider, 'GOOGLE_MAPS')
    assert.equal(upsertArgs.createData.placeName, 'Quan Pho Hong')
    assert.equal(result.metadata.totalReviewCount, 4743)
    assert.equal(auditEvent.action, 'CRAWL_SOURCE_CREATED')
    assert.equal(auditEvent.resourceId, 'source-1')
    assert.equal(auditEvent.actorUserId, 'user-1')
    assert.equal(auditEvent.metadata.current.syncIntervalMinutes, 1440)

    restoreModules()
})

test('review crawl service derives default source sync cadence from restaurant entitlement', async () => {
    restoreModules()

    let upsertArgs = null

    mockInternalOperatorAccess()
    mockRestaurantLookup()
    mockPrisma({
        restaurantEntitlement: {
            findUnique: async () => ({
                id: 'restaurant-entitlement-1',
                restaurantId: 'restaurant-1',
                planTier: 'PREMIUM',
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            upsert: async () => ({
                id: 'restaurant-entitlement-1',
                restaurantId: 'restaurant-1',
                planTier: 'PREMIUM',
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
        },
    })
    withMock('../src/modules/review-crawl/google-maps.service', {
        resolveGoogleMapsSource: async () => ({
            place: {
                name: 'Quan Pho Hong',
                totalReviewCount: 4743,
                identifiers: {
                    cid: '4548797685071303380',
                    placeHexId: '0x314219004bcdcae5:0x3f209364ddcb52d4',
                    googlePlaceId: 'ChIJ5crNSwAZQjER1FLL3WSTID8',
                },
            },
            source: {
                resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            },
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findSourceByCanonicalIdentity: async () => null,
        upsertSourceByCanonicalIdentity: async (identity, createData, updateData) => {
            upsertArgs = { identity, createData, updateData }
            return {
                id: 'source-1',
                restaurantId: identity.restaurantId,
                provider: identity.provider,
                status: 'ACTIVE',
                inputUrl: createData.inputUrl,
                resolvedUrl: createData.resolvedUrl,
                canonicalCid: identity.canonicalCid,
                placeHexId: createData.placeHexId,
                googlePlaceId: createData.googlePlaceId,
                placeName: createData.placeName,
                language: createData.language,
                region: createData.region,
                syncEnabled: createData.syncEnabled,
                syncIntervalMinutes: createData.syncIntervalMinutes,
                lastReportedTotal: createData.lastReportedTotal,
                nextScheduledAt: createData.nextScheduledAt,
                lastSyncedAt: null,
                lastSuccessfulRunAt: null,
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:00:00Z'),
            }
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.upsertReviewCrawlSource({
        userId: 'user-1',
        input: {
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            language: 'en',
            region: 'us',
            syncEnabled: true,
        },
    })

    assert.equal(result.source.syncIntervalMinutes, 360)
    assert.equal(upsertArgs.createData.syncIntervalMinutes, 360)

    restoreModules()
})

test('review crawl service audits crawl source reconfiguration when settings change', async () => {
    restoreModules()

    let auditEvent = null

    mockInternalOperatorAccess()
    mockRestaurantLookup()
    mockAuditEvents({
        appendAuditEvent: async (event) => {
            auditEvent = event
        },
    })
    withMock('../src/modules/review-crawl/google-maps.service', {
        resolveGoogleMapsSource: async () => ({
            place: {
                name: 'Quan Pho Hong',
                totalReviewCount: 4743,
                identifiers: {
                    cid: '4548797685071303380',
                    placeHexId: '0x314219004bcdcae5:0x3f209364ddcb52d4',
                    googlePlaceId: 'ChIJ5crNSwAZQjER1FLL3WSTID8',
                },
            },
            source: {
                resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            },
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findSourceByCanonicalIdentity: async () => ({
            id: 'source-1',
            restaurantId: 'restaurant-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            inputUrl: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            canonicalCid: '4548797685071303380',
            placeHexId: '0x314219004bcdcae5:0x3f209364ddcb52d4',
            googlePlaceId: 'ChIJ5crNSwAZQjER1FLL3WSTID8',
            placeName: 'Quan Pho Hong',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
        }),
        upsertSourceByCanonicalIdentity: async (identity, createData) => ({
            id: 'source-1',
            restaurantId: identity.restaurantId,
            provider: identity.provider,
            status: 'ACTIVE',
            inputUrl: createData.inputUrl,
            resolvedUrl: createData.resolvedUrl,
            canonicalCid: identity.canonicalCid,
            placeHexId: createData.placeHexId,
            googlePlaceId: createData.googlePlaceId,
            placeName: createData.placeName,
            language: createData.language,
            region: createData.region,
            syncEnabled: false,
            syncIntervalMinutes: 720,
            lastReportedTotal: createData.lastReportedTotal,
            nextScheduledAt: null,
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
            createdAt: new Date('2026-03-24T00:00:00Z'),
            updatedAt: new Date('2026-03-24T00:00:00Z'),
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    await service.upsertReviewCrawlSource({
        userId: 'user-1',
        input: {
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            language: 'en',
            region: 'us',
            syncEnabled: false,
            syncIntervalMinutes: 720,
        },
    })

    assert.equal(auditEvent.action, 'CRAWL_SOURCE_SYNC_DISABLED')
    assert.deepEqual(auditEvent.metadata.changedFields.sort(), [
        'syncEnabled',
        'syncIntervalMinutes',
    ])

    restoreModules()
})

test('review crawl service can create a source from persisted canonical identity without calling Google again', async () => {
    restoreModules()

    let googleResolveCallCount = 0
    let auditEvent = null

    mockInternalOperatorAccess()
    mockRestaurantLookup()
    mockAuditEvents({
        appendAuditEvent: async (event) => {
            auditEvent = event
        },
    })
    withMock('../src/modules/review-crawl/google-maps.service', {
        resolveGoogleMapsSource: async () => {
            googleResolveCallCount += 1
            throw new Error('resolveGoogleMapsSource should not be called')
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findSourceByCanonicalIdentity: async () => null,
        upsertSourceByCanonicalIdentity: async (identity, createData) => ({
            id: 'source-from-submission-1',
            restaurantId: identity.restaurantId,
            provider: identity.provider,
            status: 'ACTIVE',
            inputUrl: createData.inputUrl,
            resolvedUrl: createData.resolvedUrl,
            canonicalCid: identity.canonicalCid,
            placeHexId: createData.placeHexId,
            googlePlaceId: createData.googlePlaceId,
            placeName: createData.placeName,
            language: createData.language,
            region: createData.region,
            syncEnabled: createData.syncEnabled,
            syncIntervalMinutes: createData.syncIntervalMinutes,
            lastReportedTotal: createData.lastReportedTotal,
            nextScheduledAt: createData.nextScheduledAt,
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
            createdAt: new Date('2026-03-24T00:00:00Z'),
            updatedAt: new Date('2026-03-24T00:00:00Z'),
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.upsertReviewCrawlSourceFromResolvedPlace({
        userId: 'user-1',
        input: {
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 360,
        },
        resolved: {
            source: {
                resolvedUrl: 'https://www.google.com/maps?cid=4548797685071303380&hl=en&gl=US',
            },
            place: {
                name: 'Quan Pho Hong',
                totalReviewCount: null,
                identifiers: {
                    cid: '4548797685071303380',
                    placeHexId: '0x314219004bcdcae5:0x3f209364ddcb52d4',
                    googlePlaceId: 'ChIJ5crNSwAZQjER1FLL3WSTID8',
                },
            },
        },
    })

    assert.equal(googleResolveCallCount, 0)
    assert.equal(result.source.id, 'source-from-submission-1')
    assert.equal(result.source.canonicalCid, '4548797685071303380')
    assert.equal(result.metadata.totalReviewCount, null)
    assert.equal(auditEvent.action, 'CRAWL_SOURCE_CREATED')

    restoreModules()
})

test('review crawl service creates a queued run and enqueues it', async () => {
    restoreModules()

    let createdRunData = null
    let enqueuedRunId = null

    mockInternalOperatorAccess()
    mockPlatformControls()
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findSourceById: async () => ({
            id: 'source-1',
            restaurantId: 'restaurant-1',
            provider: 'GOOGLE_MAPS',
            canonicalCid: 'cid-1',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
        }),
        findActiveRunBySourceId: async () => null,
        createRun: async (data) => {
            createdRunData = data
            return {
                id: 'run-1',
                ...data,
                warningsJson: [],
                metadataJson: data.metadataJson,
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:00:00Z'),
                source: {
                    id: 'source-1',
                    restaurantId: 'restaurant-1',
                    provider: 'GOOGLE_MAPS',
                    status: 'ACTIVE',
                    inputUrl: 'https://maps.app.goo.gl/abc',
                    resolvedUrl: null,
                    canonicalCid: 'cid-1',
                    placeHexId: null,
                    googlePlaceId: null,
                    placeName: 'Quan Pho Hong',
                    language: 'en',
                    region: 'us',
                    syncEnabled: true,
                    syncIntervalMinutes: 1440,
                    lastReportedTotal: null,
                    lastSyncedAt: null,
                    lastSuccessfulRunAt: null,
                    nextScheduledAt: null,
                    createdAt: new Date('2026-03-24T00:00:00Z'),
                    updatedAt: new Date('2026-03-24T00:00:00Z'),
                },
            }
        },
        updateRun: async () => {
            throw new Error('updateRun should not be called on successful enqueue')
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async (runId) => {
            enqueuedRunId = runId
            return { id: `job:${runId}` }
        },
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/review-crawl/google-maps.service', {})
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.createReviewCrawlRun({
        userId: 'user-1',
        sourceId: 'source-1',
        input: {
            strategy: 'INCREMENTAL',
            priority: 'NORMAL',
        },
    })

    assert.equal(result.id, 'run-1')
    assert.equal(result.status, 'QUEUED')
    assert.equal(createdRunData.maxPages, 10)
    assert.equal(createdRunData.delayMs, 250)
    assert.equal(enqueuedRunId, 'run-1')
    assert.equal(result.crawlCoverage.completeness, 'IN_PROGRESS')
    assert.equal(result.crawlCoverage.operatorPolicy.code, 'WAIT_FOR_TERMINAL_RUN')

    restoreModules()
})

test('review crawl service blocks new crawl runs when platform queue writes are disabled', async () => {
    restoreModules()

    mockInternalOperatorAccess()
    mockPlatformControls({
        assertPlatformControlEnabled: async () => {
            const error = new Error('Queue writes disabled')
            error.code = 'PLATFORM_CRAWL_QUEUE_DISABLED'
            throw error
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findSourceById: async () => ({
            id: 'source-1',
            restaurantId: 'restaurant-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/review-crawl/google-maps.service', {})
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')

    await assert.rejects(
        () =>
            service.createReviewCrawlRun({
                userId: 'user-1',
                sourceId: 'source-1',
                input: {
                    strategy: 'INCREMENTAL',
                },
            }),
        (error) => {
            assert.equal(error.code, 'PLATFORM_CRAWL_QUEUE_DISABLED')
            return true
        },
    )

    restoreModules()
})

test('review crawl scheduler bootstraps ready merchant source submissions before scanning due sources', async () => {
    restoreModules()

    process.env.REVIEW_CRAWL_SCHEDULER_BATCH_SIZE = '3'

    const auditEvents = []
    const enqueuedRunIds = []
    const dueSourceListCalls = []
    const submissions = [
        {
            id: 'submission-priority',
            restaurantId: 'restaurant-priority',
            provider: 'GOOGLE_MAPS',
            inputUrl: 'https://maps.app.goo.gl/priority',
            normalizedUrl: 'https://www.google.com/maps?cid=cid-priority&hl=en&gl=US',
            canonicalCid: 'cid-priority',
            placeHexId: '0x123:0x456',
            googlePlaceId: 'place-priority',
            placeName: 'Priority Place',
            dedupeKey: 'cid:cid-priority',
            status: 'READY_FOR_SOURCE_LINK',
            schedulingLane: 'PRIORITY',
            linkedSourceId: null,
            submittedAt: new Date('2026-03-25T08:00:00Z'),
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            createdAt: new Date('2026-03-25T08:00:00Z'),
        },
        {
            id: 'submission-standard',
            restaurantId: 'restaurant-standard',
            provider: 'GOOGLE_MAPS',
            inputUrl: 'https://maps.app.goo.gl/standard',
            normalizedUrl: 'https://www.google.com/maps?cid=cid-standard&hl=en&gl=US',
            canonicalCid: 'cid-standard',
            placeHexId: '0x789:0xabc',
            googlePlaceId: 'place-standard',
            placeName: 'Standard Place',
            dedupeKey: 'cid:cid-standard',
            status: 'READY_FOR_SOURCE_LINK',
            schedulingLane: 'STANDARD',
            linkedSourceId: null,
            submittedAt: new Date('2026-03-25T09:00:00Z'),
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            createdAt: new Date('2026-03-25T09:00:00Z'),
        },
    ]

    mockPlatformControls({
        getPlatformControls: async () => ({
            crawlQueueWritesEnabled: true,
            crawlMaterializationEnabled: true,
            intakePublishEnabled: true,
            sourceSubmissionAutoBootstrapEnabled: true,
            sourceSubmissionAutoBootstrapMaxPerTick: 1,
        }),
    })
    mockAuditEvents({
        appendAuditEvent: async (event) => {
            auditEvents.push(event)
        },
    })
    mockPrisma({
        restaurantSourceSubmission: {
            findMany: async ({ where, take }) => {
                const rows = submissions
                    .filter((submission) => {
                        if (submission.provider !== where.provider) {
                            return false
                        }

                        if (submission.status && submission.status !== where.status) {
                            return false
                        }

                        if (where.linkedSourceId === null && submission.linkedSourceId !== null) {
                            return false
                        }

                        if (
                            where.schedulingLane &&
                            submission.schedulingLane !== where.schedulingLane
                        ) {
                            return false
                        }

                        if (where.dedupeKey && submission.dedupeKey !== where.dedupeKey) {
                            return false
                        }

                        if (where.claimedAt && submission.claimedAt?.getTime() !== where.claimedAt.getTime()) {
                            return false
                        }

                        if (
                            where.claimExpiresAt &&
                            submission.claimExpiresAt?.getTime() !==
                                where.claimExpiresAt.getTime()
                        ) {
                            return false
                        }

                        if (where.OR) {
                            const now = new Date(where.OR[1].claimExpiresAt.lte)
                            const leaseExpired =
                                submission.claimExpiresAt === null ||
                                submission.claimExpiresAt.getTime() <= now.getTime()

                            if (!leaseExpired) {
                                return false
                            }
                        }

                        return true
                    })
                    .sort((left, right) => left.submittedAt - right.submittedAt)

                return typeof take === 'number' ? rows.slice(0, take) : rows
            },
            updateMany: async ({ where, data }) => {
                const matching = submissions.filter((submission) => {
                    if (submission.provider !== where.provider) {
                        return false
                    }

                    if (submission.status !== where.status) {
                        return false
                    }

                    if (submission.linkedSourceId !== null) {
                        return false
                    }

                    if (submission.dedupeKey !== where.dedupeKey) {
                        return false
                    }

                    const now = new Date(where.OR[1].claimExpiresAt.lte)
                    return (
                        submission.claimExpiresAt === null ||
                        submission.claimExpiresAt.getTime() <= now.getTime()
                    )
                })

                for (const submission of matching) {
                    Object.assign(submission, data)
                }

                return {
                    count: matching.length,
                }
            },
            update: async ({ where, data }) => {
                const submission = submissions.find((candidate) => candidate.id === where.id)
                Object.assign(submission, data)
                return submission
            },
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        listDueSources: async (_now, limit) => {
            dueSourceListCalls.push(limit)
            return limit > 0
                ? [
                      {
                          id: 'due-source-1',
                          restaurantId: 'restaurant-due',
                          provider: 'GOOGLE_MAPS',
                          status: 'ACTIVE',
                          inputUrl: 'https://maps.app.goo.gl/due',
                          canonicalCid: 'cid-due',
                          syncEnabled: true,
                          syncIntervalMinutes: 1440,
                      },
                  ]
                : []
        },
        findSourceByCanonicalIdentity: async () => null,
        upsertSourceByCanonicalIdentity: async (identity, createData) => ({
            id: `source-${identity.restaurantId}`,
            restaurantId: identity.restaurantId,
            provider: identity.provider,
            status: 'ACTIVE',
            inputUrl: createData.inputUrl,
            resolvedUrl: createData.resolvedUrl,
            canonicalCid: identity.canonicalCid,
            placeHexId: createData.placeHexId,
            googlePlaceId: createData.googlePlaceId,
            placeName: createData.placeName,
            language: createData.language,
            region: createData.region,
            syncEnabled: createData.syncEnabled,
            syncIntervalMinutes: createData.syncIntervalMinutes,
            lastReportedTotal: createData.lastReportedTotal,
            nextScheduledAt: createData.nextScheduledAt,
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
            createdAt: new Date('2026-03-25T08:05:00Z'),
            updatedAt: new Date('2026-03-25T08:05:00Z'),
        }),
        findActiveRunBySourceId: async () => null,
        createRun: async (data) => ({
            id: `run-${data.sourceId}`,
            ...data,
            warningsJson: [],
            metadataJson: data.metadataJson,
            createdAt: new Date('2026-03-25T08:06:00Z'),
            updatedAt: new Date('2026-03-25T08:06:00Z'),
            source: {
                id: data.sourceId,
                restaurantId: data.restaurantId,
                provider: 'GOOGLE_MAPS',
                status: 'ACTIVE',
                inputUrl: 'https://maps.app.goo.gl/priority',
                resolvedUrl: 'https://www.google.com/maps?cid=cid-priority&hl=en&gl=US',
                canonicalCid: 'cid-priority',
                placeHexId: '0x123:0x456',
                googlePlaceId: 'place-priority',
                placeName: 'Priority Place',
                language: 'en',
                region: 'us',
                syncEnabled: true,
                syncIntervalMinutes: 1440,
                lastReportedTotal: null,
                lastSyncedAt: null,
                lastSuccessfulRunAt: null,
                nextScheduledAt: new Date('2026-03-26T08:05:00Z'),
                createdAt: new Date('2026-03-25T08:05:00Z'),
                updatedAt: new Date('2026-03-25T08:05:00Z'),
            },
        }),
        updateRun: async () => {
            throw new Error('updateRun should not be called in the bootstrap happy path')
        },
        updateSource: async () => {
            throw new Error('updateSource should not be called when queueing succeeds')
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async (runId) => {
            enqueuedRunIds.push(runId)
            return { id: `job:${runId}` }
        },
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/review-crawl/google-maps.service', {})
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.scheduleDueReviewCrawlRuns()

    assert.equal(result.sourceSubmissionBootstrap.claimedGroupCount, 1)
    assert.equal(result.sourceSubmissionBootstrap.processedSubmissionCount, 1)
    assert.equal(result.sourceSubmissionBootstrap.linkedSubmissionCount, 1)
    assert.equal(result.sourceSubmissionBootstrap.queuedRunCount, 1)
    assert.equal(result.sourceSubmissionBootstrap.reusedRunCount, 0)
    assert.equal(result.sourceSubmissionBootstrap.queueFailureCount, 0)
    assert.equal(result.sourceSubmissionBootstrap.sourceFailureCount, 0)
    assert.equal(result.scheduledCount, 1)
    assert.equal(result.scannedCount, 1)
    assert.deepEqual(dueSourceListCalls, [2])
    assert.deepEqual(enqueuedRunIds, ['run-source-restaurant-priority', 'run-due-source-1'])

    const prioritySubmission = submissions.find(
        (submission) => submission.id === 'submission-priority',
    )
    const standardSubmission = submissions.find(
        (submission) => submission.id === 'submission-standard',
    )

    assert.equal(prioritySubmission.status, 'LINKED_TO_SOURCE')
    assert.equal(prioritySubmission.linkedSourceId, 'source-restaurant-priority')
    assert.equal(prioritySubmission.claimedAt, null)
    assert.equal(prioritySubmission.claimExpiresAt, null)
    assert.equal(
        prioritySubmission.recommendationCode,
        'ALREADY_CONNECTED',
    )
    assert.equal(standardSubmission.status, 'READY_FOR_SOURCE_LINK')
    assert.equal(standardSubmission.linkedSourceId, null)

    assert.ok(
        auditEvents.some((event) => event.action === 'CRAWL_SOURCE_CREATED'),
    )
    assert.ok(
        auditEvents.some(
            (event) =>
                event.action === 'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED' &&
                event.resourceId === 'submission-priority',
        ),
    )
    const bootstrapAuditEvent = auditEvents.find(
        (event) =>
            event.action === 'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED' &&
            event.resourceId === 'submission-priority',
    )
    assert.equal(
        bootstrapAuditEvent.metadata.sourceSubmissionSnapshot.linkedSourceId,
        'source-restaurant-priority',
    )

    restoreModules()
})

test('review crawl scheduler can skip merchant source auto-bootstrap via platform controls', async () => {
    restoreModules()

    process.env.REVIEW_CRAWL_SCHEDULER_BATCH_SIZE = '3'

    const dueSourceListCalls = []

    mockPlatformControls({
        getPlatformControls: async () => ({
            crawlQueueWritesEnabled: true,
            crawlMaterializationEnabled: true,
            intakePublishEnabled: true,
            sourceSubmissionAutoBootstrapEnabled: false,
            sourceSubmissionAutoBootstrapMaxPerTick: 1,
        }),
    })
    mockPrisma({
        restaurantSourceSubmission: {
            findMany: async () => {
                throw new Error('source submission lookup should be skipped when auto-bootstrap is disabled')
            },
            updateMany: async () => {
                throw new Error('source submission claim should be skipped when auto-bootstrap is disabled')
            },
            update: async () => {
                throw new Error('source submission mutation should be skipped when auto-bootstrap is disabled')
            },
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        listDueSources: async (_now, limit) => {
            dueSourceListCalls.push(limit)
            return []
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job:noop' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/review-crawl/google-maps.service', {})
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.scheduleDueReviewCrawlRuns()

    assert.deepEqual(result.sourceSubmissionBootstrap, {
        claimedGroupCount: 0,
        processedSubmissionCount: 0,
        linkedSubmissionCount: 0,
        queuedRunCount: 0,
        reusedRunCount: 0,
        queueFailureCount: 0,
        sourceFailureCount: 0,
    })
    assert.equal(result.scheduledCount, 0)
    assert.equal(result.scannedCount, 0)
    assert.deepEqual(dueSourceListCalls, [3])

    restoreModules()
})

test('review crawl service completes an incremental run when the known review streak limit is reached', async () => {
    restoreModules()

    process.env.REVIEW_CRAWL_KNOWN_REVIEW_STREAK_LIMIT = '2'

    const runState = {
        id: 'run-1',
        sourceId: 'source-1',
        restaurantId: 'restaurant-1',
        requestedByUserId: 'user-1',
        intakeBatchId: null,
        strategy: 'INCREMENTAL',
        status: 'QUEUED',
        priority: 'NORMAL',
        reportedTotal: null,
        extractedCount: 0,
        validCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
        warningCount: 0,
        pagesFetched: 0,
        pageSize: 20,
        delayMs: 0,
        maxPages: 10,
        maxReviews: null,
        checkpointCursor: null,
        knownReviewStreak: 0,
        cancelRequestedAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
        errorMessage: null,
        warningsJson: [],
        metadataJson: {},
        queuedAt: new Date('2026-03-24T00:00:00Z'),
        startedAt: null,
        lastCheckpointAt: null,
        finishedAt: null,
        createdAt: new Date('2026-03-24T00:00:00Z'),
        updatedAt: new Date('2026-03-24T00:00:00Z'),
        source: {
            id: 'source-1',
            restaurantId: 'restaurant-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            inputUrl: 'https://maps.app.goo.gl/abc',
            resolvedUrl: null,
            canonicalCid: 'cid-1',
            placeHexId: 'hex-1',
            googlePlaceId: 'place-1',
            placeName: 'Quan Pho Hong',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
            lastReportedTotal: null,
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
            nextScheduledAt: null,
            createdAt: new Date('2026-03-24T00:00:00Z'),
            updatedAt: new Date('2026-03-24T00:00:00Z'),
        },
        intakeBatch: null,
    }

    const rawReviewState = new Map([
        ['google-maps:review:a', { externalReviewKey: 'google-maps:review:a', firstSeenRunId: 'older-run' }],
        ['google-maps:review:b', { externalReviewKey: 'google-maps:review:b', firstSeenRunId: 'older-run' }],
    ])

    mockInternalOperatorAccess()
    withMock('../src/modules/review-crawl/google-maps.service', {
        initializeGoogleMapsReviewSession: async () => ({
            place: {
                totalReviewCount: 4743,
                identifiers: {
                    placeHexId: 'hex-1',
                },
            },
            source: {
                resolvedUrl: 'https://www.google.com/maps?cid=cid-1',
            },
            client: {},
            sessionToken: 'session-token',
        }),
        fetchGoogleMapsReviewPage: async () => ({
            nextPageToken: 'next-token',
            reviews: [
                {
                    reviewId: 'a',
                    externalReviewKey: 'google-maps:review:a',
                    rating: 5,
                    author: { name: 'Ana' },
                    publishedAt: '2026-03-20T00:00:00.000Z',
                    reviewUrl: 'https://www.google.com/maps/review/a',
                },
                {
                    reviewId: 'b',
                    externalReviewKey: 'google-maps:review:b',
                    rating: 4,
                    author: { name: 'Bo' },
                    publishedAt: '2026-03-19T00:00:00.000Z',
                    reviewUrl: 'https://www.google.com/maps/review/b',
                },
            ],
        }),
        validateReviewForIntake: (review) => ({
            item: {
                sourceProvider: 'GOOGLE_MAPS',
                sourceExternalId: review.externalReviewKey,
                sourceReviewUrl: review.reviewUrl,
                rawAuthorName: review.author.name,
                rawRating: review.rating,
                rawContent: null,
                rawReviewDate: review.publishedAt,
            },
            issues: [],
            warnings: [],
        }),
        sleep: async () => {},
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findRunById: async (runId, options = {}) => {
            if (runId !== 'run-1') {
                return null
            }

            return {
                ...runState,
                ...(options.includeSource ? { source: runState.source } : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: runState.intakeBatch } : {}),
            }
        },
        updateRunMany: async () => ({ count: 1 }),
        updateRun: async (runId, data, options = {}) => {
            Object.assign(runState, data, { updatedAt: new Date('2026-03-24T00:05:00Z') })
            return {
                ...runState,
                ...(options.includeSource ? { source: runState.source } : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: runState.intakeBatch } : {}),
            }
        },
        updateSource: async (_sourceId, data) => {
            Object.assign(runState.source, data)
            return runState.source
        },
        findRawReviewsBySourceAndKeys: async () => [...rawReviewState.values()],
        upsertRawReview: async (_sourceId, externalReviewKey, data) => {
            rawReviewState.set(externalReviewKey, {
                externalReviewKey,
                ...rawReviewState.get(externalReviewKey),
                ...data,
            })
            return rawReviewState.get(externalReviewKey)
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.processReviewCrawlRun('run-1', {
        attemptsMade: 0,
        opts: { attempts: 1 },
    })

    assert.equal(result.status, 'COMPLETED')
    assert.equal(result.knownReviewStreak, 2)
    assert.equal(result.pagesFetched, 1)
    assert.equal(result.duplicateCount, 2)
    assert.equal(result.validCount, 2)
    assert.equal(result.metadata.stopReason, 'known_review_streak')

    restoreModules()
})

test('review crawl service auto-resumes a premature backfill run from the saved checkpoint cursor', async () => {
    restoreModules()

    process.env.REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS = '3'

    let enqueuedRunId = null

    const runState = {
        id: 'run-auto',
        sourceId: 'source-1',
        restaurantId: 'restaurant-1',
        requestedByUserId: 'user-1',
        intakeBatchId: null,
        strategy: 'BACKFILL',
        status: 'QUEUED',
        priority: 'NORMAL',
        reportedTotal: 4746,
        extractedCount: 20,
        validCount: 20,
        skippedCount: 0,
        duplicateCount: 0,
        warningCount: 0,
        pagesFetched: 1,
        pageSize: 20,
        delayMs: 0,
        maxPages: 250,
        maxReviews: null,
        checkpointCursor: 'cursor-page-2',
        knownReviewStreak: 0,
        cancelRequestedAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
        errorMessage: null,
        warningsJson: [],
        metadataJson: {},
        queuedAt: new Date('2026-03-25T00:00:00Z'),
        startedAt: null,
        lastCheckpointAt: new Date('2026-03-25T00:01:00Z'),
        finishedAt: null,
        createdAt: new Date('2026-03-25T00:00:00Z'),
        updatedAt: new Date('2026-03-25T00:00:00Z'),
        source: {
            id: 'source-1',
            restaurantId: 'restaurant-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            inputUrl: 'https://maps.app.goo.gl/abc',
            resolvedUrl: null,
            canonicalCid: 'cid-1',
            placeHexId: 'hex-1',
            googlePlaceId: 'place-1',
            placeName: 'Quan Pho Hong',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
            lastReportedTotal: 4746,
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
            nextScheduledAt: null,
            createdAt: new Date('2026-03-25T00:00:00Z'),
            updatedAt: new Date('2026-03-25T00:00:00Z'),
        },
        intakeBatch: null,
    }

    mockInternalOperatorAccess()
    withMock('../src/modules/review-crawl/google-maps.service', {
        initializeGoogleMapsReviewSession: async () => ({
            place: {
                totalReviewCount: 4746,
                identifiers: {
                    placeHexId: 'hex-1',
                },
            },
            source: {
                sourcePageUrl: 'https://maps.google.com/maps/place/hex-1',
            },
            client: {},
            sessionToken: 'session-token',
        }),
        fetchGoogleMapsReviewPageWithRecovery: async () => ({
            page: {
                nextPageToken: null,
                reviews: [],
            },
            attempts: 1,
            suspiciousEmpty: true,
        }),
        recoverCursorWithFreshSessions: async () => ({
            session: null,
            pageResult: {
                page: {
                    nextPageToken: null,
                    reviews: [],
                },
                attempts: 2,
                suspiciousEmpty: true,
            },
            attempts: 2,
            recovered: false,
        }),
        validateReviewForIntake: () => ({
            item: null,
            issues: [],
            warnings: [],
        }),
        sleep: async () => {},
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findRunById: async (runId, options = {}) => {
            if (runId !== 'run-auto') {
                return null
            }

            return {
                ...runState,
                ...(options.includeSource ? { source: runState.source } : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: runState.intakeBatch } : {}),
            }
        },
        updateRunMany: async () => ({ count: 1 }),
        updateRun: async (_runId, data, options = {}) => {
            Object.assign(runState, data, { updatedAt: new Date('2026-03-25T00:05:00Z') })
            return {
                ...runState,
                ...(options.includeSource ? { source: runState.source } : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: runState.intakeBatch } : {}),
            }
        },
        updateSource: async (_sourceId, data) => {
            Object.assign(runState.source, data)
            return runState.source
        },
        findRawReviewsBySourceAndKeys: async () => [],
        upsertRawReview: async () => null,
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async (runId) => {
            enqueuedRunId = runId
            return { id: `job-${runId}` }
        },
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.processReviewCrawlRun('run-auto', {
        attemptsMade: 0,
        opts: { attempts: 1 },
    })

    assert.equal(result.status, 'QUEUED')
    assert.equal(result.checkpointCursor, 'cursor-page-2')
    assert.equal(result.metadata.autoResumeChainCount, 1)
    assert.equal(enqueuedRunId, 'run-auto')

    restoreModules()
})

test('review crawl service keeps a reported-total mismatch warning when the source exhausts early', async () => {
    restoreModules()

    const runState = {
        id: 'run-mismatch',
        sourceId: 'source-1',
        restaurantId: 'restaurant-1',
        requestedByUserId: 'user-1',
        intakeBatchId: null,
        strategy: 'BACKFILL',
        status: 'QUEUED',
        priority: 'NORMAL',
        reportedTotal: 5,
        extractedCount: 0,
        validCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
        warningCount: 0,
        pagesFetched: 0,
        pageSize: 20,
        delayMs: 0,
        maxPages: 250,
        maxReviews: null,
        checkpointCursor: null,
        knownReviewStreak: 0,
        cancelRequestedAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
        errorMessage: null,
        warningsJson: [],
        metadataJson: {},
        queuedAt: new Date('2026-03-25T00:00:00Z'),
        startedAt: null,
        lastCheckpointAt: null,
        finishedAt: null,
        createdAt: new Date('2026-03-25T00:00:00Z'),
        updatedAt: new Date('2026-03-25T00:00:00Z'),
        source: {
            id: 'source-1',
            restaurantId: 'restaurant-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            inputUrl: 'https://maps.app.goo.gl/abc',
            resolvedUrl: null,
            canonicalCid: 'cid-1',
            placeHexId: 'hex-1',
            googlePlaceId: 'place-1',
            placeName: 'Quan Pho Hong',
            language: 'en',
            region: 'us',
            syncEnabled: true,
            syncIntervalMinutes: 1440,
            lastReportedTotal: 5,
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
            nextScheduledAt: null,
            createdAt: new Date('2026-03-25T00:00:00Z'),
            updatedAt: new Date('2026-03-25T00:00:00Z'),
        },
        intakeBatch: null,
    }

    mockInternalOperatorAccess()
    withMock('../src/modules/review-crawl/google-maps.service', {
        initializeGoogleMapsReviewSession: async () => ({
            place: {
                totalReviewCount: 5,
                identifiers: {
                    placeHexId: 'hex-1',
                },
            },
            source: {
                resolvedUrl: 'https://www.google.com/maps?cid=cid-1',
            },
            client: {},
            sessionToken: 'session-token',
        }),
        fetchGoogleMapsReviewPageWithRecovery: async () => ({
            page: {
                nextPageToken: null,
                reviews: [
                    {
                        reviewId: 'a',
                        externalReviewKey: 'google-maps:review:a',
                        rating: 5,
                        author: { name: 'Ana' },
                        publishedAt: '2026-03-24T00:00:00.000Z',
                        reviewUrl: 'https://www.google.com/maps/review/a',
                    },
                ],
            },
            attempts: 1,
            suspiciousEmpty: false,
        }),
        recoverCursorWithFreshSessions: async () => ({
            recovered: false,
        }),
        validateReviewForIntake: (review) => ({
            item: {
                sourceProvider: 'GOOGLE_MAPS',
                sourceExternalId: review.externalReviewKey,
                sourceReviewUrl: review.reviewUrl,
                rawAuthorName: review.author.name,
                rawRating: review.rating,
                rawContent: null,
                rawReviewDate: review.publishedAt,
            },
            issues: [],
            warnings: [],
        }),
        sleep: async () => {},
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findRunById: async (runId, options = {}) => {
            if (runId !== 'run-mismatch') {
                return null
            }

            return {
                ...runState,
                ...(options.includeSource ? { source: runState.source } : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: runState.intakeBatch } : {}),
            }
        },
        updateRunMany: async () => ({ count: 1 }),
        updateRun: async (_runId, data, options = {}) => {
            Object.assign(runState, data, { updatedAt: new Date('2026-03-25T00:05:00Z') })
            return {
                ...runState,
                ...(options.includeSource ? { source: runState.source } : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: runState.intakeBatch } : {}),
            }
        },
        updateSource: async (_sourceId, data) => {
            Object.assign(runState.source, data)
            return runState.source
        },
        findRawReviewsBySourceAndKeys: async () => [],
        upsertRawReview: async (_sourceId, externalReviewKey, data) => ({
            externalReviewKey,
            ...data,
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-run-mismatch' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {})

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.processReviewCrawlRun('run-mismatch', {
        attemptsMade: 0,
        opts: { attempts: 1 },
    })

    assert.equal(result.status, 'COMPLETED')
    assert.equal(result.extractedCount, 1)
    assert.equal(result.warningCount, 1)
    assert.equal(result.crawlCoverage.completeness, 'PUBLIC_CHAIN_EXHAUSTED')
    assert.equal(result.crawlCoverage.reportedTotal, 5)
    assert.equal(result.crawlCoverage.reportedTotalDelta, 4)
    assert.equal(
        result.crawlCoverage.mismatchStatus,
        'REPORTED_TOTAL_EXCEEDS_EXTRACTED',
    )
    assert.equal(result.crawlCoverage.publicReviewChainExhausted, true)
    assert.equal(result.crawlCoverage.stopReason, 'exhausted_source')
    assert.equal(
        result.crawlCoverage.operatorPolicy.code,
        'REPORTED_TOTAL_IS_ADVISORY',
    )
    assert.equal(result.crawlCoverage.operatorPolicy.actionRequired, false)
    assert.match(
        result.warnings[0],
        /Google Maps reported 5 reviews, but only 1 unique reviews were extracted/,
    )

    restoreModules()
})

test('review crawl service materializes a completed run into a Google Maps draft intake batch', async () => {
    restoreModules()

    const createdChunks = []

    mockInternalOperatorAccess()
    mockPlatformControls()
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findRunById: async (runId, options = {}) => {
            if (runId !== 'run-1') {
                return null
            }

            return {
                id: 'run-1',
                sourceId: 'source-1',
                restaurantId: 'restaurant-1',
                requestedByUserId: 'user-1',
                intakeBatchId: null,
                strategy: 'BACKFILL',
                status: 'COMPLETED',
                priority: 'NORMAL',
                reportedTotal: 4743,
                extractedCount: 20,
                validCount: 2,
                skippedCount: 0,
                duplicateCount: 0,
                warningCount: 0,
                pagesFetched: 1,
                pageSize: 20,
                delayMs: 0,
                maxPages: 10,
                maxReviews: null,
                checkpointCursor: null,
                knownReviewStreak: 0,
                cancelRequestedAt: null,
                errorCode: null,
                errorMessage: null,
                warningsJson: [],
                metadataJson: {},
                queuedAt: new Date('2026-03-24T00:00:00Z'),
                startedAt: new Date('2026-03-24T00:00:05Z'),
                lastCheckpointAt: new Date('2026-03-24T00:01:00Z'),
                finishedAt: new Date('2026-03-24T00:02:00Z'),
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:02:00Z'),
                ...(options.includeSource
                    ? {
                          source: {
                              id: 'source-1',
                              restaurantId: 'restaurant-1',
                              provider: 'GOOGLE_MAPS',
                              status: 'ACTIVE',
                              inputUrl: 'https://maps.app.goo.gl/abc',
                              resolvedUrl: null,
                              canonicalCid: 'cid-1',
                              placeHexId: 'hex-1',
                              googlePlaceId: 'place-1',
                              placeName: 'Quan Pho Hong',
                              language: 'en',
                              region: 'us',
                              syncEnabled: true,
                              syncIntervalMinutes: 1440,
                              lastReportedTotal: 4743,
                              lastSyncedAt: new Date('2026-03-24T00:02:00Z'),
                              lastSuccessfulRunAt: new Date('2026-03-24T00:02:00Z'),
                              nextScheduledAt: new Date('2026-03-25T00:02:00Z'),
                              createdAt: new Date('2026-03-24T00:00:00Z'),
                              updatedAt: new Date('2026-03-24T00:02:00Z'),
                          },
                      }
                    : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: null } : {}),
            }
        },
        listRunRawReviews: async () => [
            {
                id: 'raw-1',
                validForIntake: true,
                intakeItemPayload: {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:a',
                    sourceReviewUrl: 'https://www.google.com/maps/review/a',
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great pho',
                    rawReviewDate: '2026-03-20T00:00:00.000Z',
                },
            },
            {
                id: 'raw-2',
                validForIntake: true,
                intakeItemPayload: {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:b',
                    sourceReviewUrl: 'https://www.google.com/maps/review/b',
                    rawAuthorName: 'Bo',
                    rawRating: 4,
                    rawContent: 'Solid service',
                    rawReviewDate: '2026-03-19T00:00:00.000Z',
                },
            },
        ],
        updateRun: async () => ({}),
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/review-crawl/google-maps.service', {})
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findOpenBatchByCrawlSourceId: async () => null,
        createBatch: async (data) => ({
            id: 'batch-1',
            restaurantId: data.restaurantId,
            createdByUserId: data.createdByUserId,
            crawlSourceId: data.crawlSourceId,
            title: data.title,
            sourceType: data.sourceType,
            status: 'DRAFT',
            items: [],
            createdAt: new Date('2026-03-24T00:03:00Z'),
            updatedAt: new Date('2026-03-24T00:03:00Z'),
        }),
        createItems: async (_batchId, _restaurantId, items) => {
            createdChunks.push(items)
            return { count: items.length }
        },
        findBatchById: async () => ({
            id: 'batch-1',
            restaurantId: 'restaurant-1',
            createdByUserId: 'user-1',
            title: 'Google Maps crawl - Quan Pho Hong - backfill - run-1',
            sourceType: 'GOOGLE_MAPS_CRAWL',
            status: 'DRAFT',
            publishedAt: null,
            createdAt: new Date('2026-03-24T00:03:00Z'),
            updatedAt: new Date('2026-03-24T00:03:00Z'),
            items: [
                {
                    id: 'item-1',
                    batchId: 'batch-1',
                    restaurantId: 'restaurant-1',
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:a',
                    sourceReviewUrl: 'https://www.google.com/maps/review/a',
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great pho',
                    rawReviewDate: new Date('2026-03-20T00:00:00.000Z'),
                    normalizedAuthorName: 'Ana',
                    normalizedRating: 5,
                    normalizedContent: 'Great pho',
                    normalizedReviewDate: new Date('2026-03-20T00:00:00.000Z'),
                    approvalStatus: 'PENDING',
                    reviewerNote: null,
                    canonicalReviewId: null,
                    createdAt: new Date('2026-03-24T00:03:00Z'),
                    updatedAt: new Date('2026-03-24T00:03:00Z'),
                },
            ],
        }),
    })

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.materializeRunToIntake({
        userId: 'user-1',
        runId: 'run-1',
    })

    assert.equal(result.batch.sourceType, 'GOOGLE_MAPS_CRAWL')
    assert.equal(result.materializedCount, 1)
    assert.equal(createdChunks.length, 1)
    assert.equal(createdChunks[0][0].sourceExternalId, 'google-maps:review:b')

    restoreModules()
})

test('review crawl service reuses an open source draft batch and appends only unseen items', async () => {
    restoreModules()

    let createdItems = null
    let updatedRunIntakeBatchId = null

    mockInternalOperatorAccess()
    mockPlatformControls()
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findRunById: async (runId, options = {}) => {
            if (runId !== 'run-2') {
                return null
            }

            return {
                id: 'run-2',
                sourceId: 'source-1',
                restaurantId: 'restaurant-1',
                requestedByUserId: 'user-1',
                intakeBatchId: null,
                strategy: 'BACKFILL',
                status: 'PARTIAL',
                priority: 'NORMAL',
                reportedTotal: 4743,
                extractedCount: 40,
                validCount: 2,
                skippedCount: 0,
                duplicateCount: 0,
                warningCount: 0,
                pagesFetched: 2,
                pageSize: 20,
                delayMs: 0,
                maxPages: 2,
                maxReviews: null,
                checkpointCursor: 'next-page',
                knownReviewStreak: 0,
                cancelRequestedAt: null,
                errorCode: null,
                errorMessage: null,
                warningsJson: [],
                metadataJson: {},
                queuedAt: new Date('2026-03-24T00:00:00Z'),
                startedAt: new Date('2026-03-24T00:00:05Z'),
                lastCheckpointAt: new Date('2026-03-24T00:03:00Z'),
                finishedAt: new Date('2026-03-24T00:04:00Z'),
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:04:00Z'),
                ...(options.includeSource
                    ? {
                          source: {
                              id: 'source-1',
                              restaurantId: 'restaurant-1',
                              provider: 'GOOGLE_MAPS',
                              status: 'ACTIVE',
                              inputUrl: 'https://maps.app.goo.gl/abc',
                              resolvedUrl: null,
                              canonicalCid: 'cid-1',
                              placeHexId: 'hex-1',
                              googlePlaceId: 'place-1',
                              placeName: 'Quan Pho Hong',
                              language: 'en',
                              region: 'us',
                              syncEnabled: true,
                              syncIntervalMinutes: 1440,
                              lastReportedTotal: 4743,
                              lastSyncedAt: new Date('2026-03-24T00:04:00Z'),
                              lastSuccessfulRunAt: new Date('2026-03-24T00:04:00Z'),
                              nextScheduledAt: new Date('2026-03-25T00:04:00Z'),
                              createdAt: new Date('2026-03-24T00:00:00Z'),
                              updatedAt: new Date('2026-03-24T00:04:00Z'),
                          },
                      }
                    : {}),
                ...(options.includeIntakeBatch ? { intakeBatch: null } : {}),
            }
        },
        listRunRawReviews: async () => [
            {
                id: 'raw-1',
                validForIntake: true,
                intakeItemPayload: {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:a',
                    sourceReviewUrl: 'https://www.google.com/maps/review/a',
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great pho',
                    rawReviewDate: '2026-03-20T00:00:00.000Z',
                },
            },
            {
                id: 'raw-2',
                validForIntake: true,
                intakeItemPayload: {
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:b',
                    sourceReviewUrl: 'https://www.google.com/maps/review/b',
                    rawAuthorName: 'Bo',
                    rawRating: 4,
                    rawContent: 'Solid service',
                    rawReviewDate: '2026-03-19T00:00:00.000Z',
                },
            },
        ],
        updateRun: async (_runId, data) => {
            updatedRunIntakeBatchId = data.intakeBatchId ?? updatedRunIntakeBatchId
            return {}
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        enqueueReviewCrawlRun: async () => ({ id: 'job-1' }),
        isInlineQueueMode: () => false,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
    })
    withMock('../src/modules/review-crawl/google-maps.service', {})
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findOpenBatchByCrawlSourceId: async () => ({
            id: 'batch-open',
            restaurantId: 'restaurant-1',
            createdByUserId: 'user-1',
            crawlSourceId: 'source-1',
            title: 'Google Maps crawl - Quan Pho Hong',
            sourceType: 'GOOGLE_MAPS_CRAWL',
            status: 'DRAFT',
            publishedAt: null,
            createdAt: new Date('2026-03-24T00:03:00Z'),
            updatedAt: new Date('2026-03-24T00:03:00Z'),
            items: [
                {
                    id: 'item-1',
                    batchId: 'batch-open',
                    restaurantId: 'restaurant-1',
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:a',
                    sourceReviewUrl: 'https://www.google.com/maps/review/a',
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great pho',
                    rawReviewDate: new Date('2026-03-20T00:00:00.000Z'),
                    normalizedAuthorName: 'Ana',
                    normalizedRating: 5,
                    normalizedContent: 'Great pho',
                    normalizedReviewDate: new Date('2026-03-20T00:00:00.000Z'),
                    approvalStatus: 'PENDING',
                    reviewerNote: null,
                    canonicalReviewId: null,
                    createdAt: new Date('2026-03-24T00:03:00Z'),
                    updatedAt: new Date('2026-03-24T00:03:00Z'),
                },
            ],
        }),
        createItems: async (_batchId, _restaurantId, items) => {
            createdItems = items
            return { count: items.length }
        },
        findBatchById: async () => ({
            id: 'batch-open',
            restaurantId: 'restaurant-1',
            createdByUserId: 'user-1',
            crawlSourceId: 'source-1',
            title: 'Google Maps crawl - Quan Pho Hong',
            sourceType: 'GOOGLE_MAPS_CRAWL',
            status: 'DRAFT',
            publishedAt: null,
            createdAt: new Date('2026-03-24T00:03:00Z'),
            updatedAt: new Date('2026-03-24T00:03:00Z'),
            items: [
                {
                    id: 'item-1',
                    batchId: 'batch-open',
                    restaurantId: 'restaurant-1',
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:a',
                    sourceReviewUrl: 'https://www.google.com/maps/review/a',
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great pho',
                    rawReviewDate: new Date('2026-03-20T00:00:00.000Z'),
                    normalizedAuthorName: 'Ana',
                    normalizedRating: 5,
                    normalizedContent: 'Great pho',
                    normalizedReviewDate: new Date('2026-03-20T00:00:00.000Z'),
                    approvalStatus: 'PENDING',
                    reviewerNote: null,
                    canonicalReviewId: null,
                    createdAt: new Date('2026-03-24T00:03:00Z'),
                    updatedAt: new Date('2026-03-24T00:03:00Z'),
                },
                {
                    id: 'item-2',
                    batchId: 'batch-open',
                    restaurantId: 'restaurant-1',
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:b',
                    sourceReviewUrl: 'https://www.google.com/maps/review/b',
                    rawAuthorName: 'Bo',
                    rawRating: 4,
                    rawContent: 'Solid service',
                    rawReviewDate: new Date('2026-03-19T00:00:00.000Z'),
                    normalizedAuthorName: 'Bo',
                    normalizedRating: 4,
                    normalizedContent: 'Solid service',
                    normalizedReviewDate: new Date('2026-03-19T00:00:00.000Z'),
                    approvalStatus: 'PENDING',
                    reviewerNote: null,
                    canonicalReviewId: null,
                    createdAt: new Date('2026-03-24T00:04:00Z'),
                    updatedAt: new Date('2026-03-24T00:04:00Z'),
                },
            ],
        }),
    })

    const service = require('../src/modules/review-crawl/review-crawl.service')
    const result = await service.materializeRunToIntake({
        userId: 'user-1',
        runId: 'run-2',
    })

    assert.equal(updatedRunIntakeBatchId, 'batch-open')
    assert.equal(createdItems.length, 1)
    assert.equal(createdItems[0].sourceExternalId, 'google-maps:review:b')
    assert.equal(result.materializedCount, 1)
    assert.equal(result.batch.id, 'batch-open')

    restoreModules()
})

test('review crawl service blocks materialization when platform controls disable it', async () => {
    restoreModules()

    mockInternalOperatorAccess()
    mockPlatformControls({
        assertPlatformControlEnabled: async (key) => {
            if (key === 'crawlMaterializationEnabled') {
                const error = new Error('Materialization disabled')
                error.code = 'PLATFORM_CRAWL_MATERIALIZATION_DISABLED'
                throw error
            }

            return {
                crawlQueueWritesEnabled: true,
                crawlMaterializationEnabled: false,
            }
        },
    })

    const service = require('../src/modules/review-crawl/review-crawl.service')

    await assert.rejects(
        () =>
            service.materializeRunToIntake({
                userId: 'user-1',
                runId: 'run-1',
            }),
        (error) => {
            assert.equal(error.code, 'PLATFORM_CRAWL_MATERIALIZATION_DISABLED')
            return true
        },
    )

    restoreModules()
})
