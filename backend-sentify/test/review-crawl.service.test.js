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

function restoreModules() {
    clearModule('../src/modules/review-crawl/review-crawl.service')
    clearModule('../src/modules/review-crawl/review-crawl.repository')
    clearModule('../src/modules/review-crawl/review-crawl.queue')
    clearModule('../src/modules/review-crawl/review-crawl.runtime')
    clearModule('../src/modules/review-crawl/google-maps.service')
    clearModule('../src/services/restaurant-access.service')
    clearModule('../src/modules/admin-intake/admin-intake.domain')
    clearModule('../src/modules/admin-intake/admin-intake.repository')
    clearModule('../src/config/env')
}

test('review crawl service upserts a canonical Google Maps source', async () => {
    restoreModules()

    process.env.REVIEW_CRAWL_SCHEDULER_INTERVAL_MS = '60000'

    let upsertArgs = null

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
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

    restoreModules()
})

test('review crawl service creates a queued run and enqueues it', async () => {
    restoreModules()

    let createdRunData = null
    let enqueuedRunId = null

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
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

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
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

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
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

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
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

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
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

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
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
