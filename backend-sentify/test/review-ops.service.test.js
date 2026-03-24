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
    clearModule('../src/modules/review-ops/review-ops.service')
    clearModule('../src/modules/review-crawl/review-crawl.service')
    clearModule('../src/modules/review-crawl/review-crawl.repository')
    clearModule('../src/modules/review-crawl/review-crawl.queue')
    clearModule('../src/modules/review-crawl/review-crawl.runtime')
    clearModule('../src/modules/admin-intake/admin-intake.domain')
    clearModule('../src/modules/admin-intake/admin-intake.repository')
    clearModule('../src/modules/admin-intake/admin-intake.service')
    clearModule('../src/services/restaurant-access.service')
    clearModule('../src/services/sentiment-analyzer.service')
}

test('review ops sync-to-draft upserts a source and creates a DRAFT materializing run', async () => {
    restoreModules()

    let createRunArgs = null

    withMock('../src/modules/review-crawl/review-crawl.service', {
        upsertReviewCrawlSource: async () => ({
            source: {
                id: 'source-1',
                restaurantId: 'restaurant-1',
                provider: 'GOOGLE_MAPS',
                canonicalCid: 'cid-1',
                lastSuccessfulRunAt: null,
            },
        }),
        createReviewCrawlRun: async (args) => {
            createRunArgs = args
            return {
                id: 'run-1',
                sourceId: args.sourceId,
                status: 'QUEUED',
                strategy: args.input.strategy,
                metadata: args.metadata,
            }
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        findActiveRunBySourceId: async () => null,
    })

    const service = require('../src/modules/review-ops/review-ops.service')
    const result = await service.syncGoogleMapsToDraft({
        userId: 'user-1',
        input: {
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
            language: 'vi',
            region: 'vn',
        },
    })

    assert.equal(createRunArgs.reuseActiveRun, true)
    assert.equal(createRunArgs.trigger, 'review_ops')
    assert.equal(createRunArgs.input.strategy, 'BACKFILL')
    assert.equal(createRunArgs.metadata.materializeMode, 'DRAFT')
    assert.equal(result.run.id, 'run-1')
    assert.equal(result.draftPolicy.publishMode, 'MANUAL')

    restoreModules()
})

test('review ops lists sources with latest run, open draft batch, and runtime health', async () => {
    restoreModules()

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        listSourcesByRestaurant: async () => [
            {
                id: 'source-1',
                restaurantId: 'restaurant-1',
                provider: 'GOOGLE_MAPS',
                status: 'ACTIVE',
                inputUrl: 'https://maps.app.goo.gl/abc',
                resolvedUrl: 'https://www.google.com/maps?cid=123',
                canonicalCid: '123',
                placeHexId: 'hex-1',
                googlePlaceId: 'place-1',
                placeName: 'Quan Pho Hong',
                language: 'vi',
                region: 'vn',
                syncEnabled: true,
                syncIntervalMinutes: 1440,
                lastReportedTotal: 4743,
                lastSyncedAt: new Date('2026-03-24T00:00:00Z'),
                lastSuccessfulRunAt: new Date('2026-03-24T00:00:00Z'),
                nextScheduledAt: new Date('2026-03-25T00:00:00Z'),
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:00:00Z'),
                runs: [
                    {
                        id: 'run-1',
                        sourceId: 'source-1',
                        restaurantId: 'restaurant-1',
                        requestedByUserId: 'user-1',
                        intakeBatchId: 'batch-1',
                        strategy: 'BACKFILL',
                        status: 'PARTIAL',
                        priority: 'NORMAL',
                        reportedTotal: 4743,
                        extractedCount: 20,
                        validCount: 18,
                        skippedCount: 2,
                        duplicateCount: 0,
                        warningCount: 1,
                        pagesFetched: 1,
                        pageSize: 20,
                        delayMs: 500,
                        maxPages: 1,
                        maxReviews: null,
                        checkpointCursor: 'next-token',
                        knownReviewStreak: 0,
                        cancelRequestedAt: null,
                        leaseExpiresAt: null,
                        errorCode: null,
                        errorMessage: null,
                        warningsJson: ['partial'],
                        metadataJson: {
                            materializeMode: 'DRAFT',
                            stopReason: 'premature_exhaustion',
                        },
                        queuedAt: new Date('2026-03-24T00:00:00Z'),
                        startedAt: new Date('2026-03-24T00:00:05Z'),
                        lastCheckpointAt: new Date('2026-03-24T00:01:00Z'),
                        finishedAt: new Date('2026-03-24T00:02:00Z'),
                        createdAt: new Date('2026-03-24T00:00:00Z'),
                        updatedAt: new Date('2026-03-24T00:02:00Z'),
                        intakeBatch: {
                            id: 'batch-1',
                            status: 'DRAFT',
                            title: 'Google Maps crawl',
                        },
                    },
                ],
                intakeBatches: [
                    {
                        id: 'batch-1',
                        status: 'DRAFT',
                        title: 'Google Maps crawl',
                        createdAt: new Date('2026-03-24T00:00:00Z'),
                        updatedAt: new Date('2026-03-24T00:02:00Z'),
                    },
                ],
            },
        ],
        countDueSources: async () => 0,
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        getRedisConnection: () => ({ id: 'redis-1' }),
        getReviewCrawlQueueHealth: async () => ({
            configured: true,
            counts: { waiting: 1, active: 1, failed: 0 },
        }),
        getReviewCrawlJob: async () => null,
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        readReviewCrawlWorkerHealth: async () => ({
            configured: true,
            scheduler: { pid: 1 },
            processors: [{ pid: 2 }],
        }),
    })

    const service = require('../src/modules/review-ops/review-ops.service')
    const result = await service.listSources({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
    })

    assert.equal(result.sources.length, 1)
    assert.equal(result.sources[0].latestRun.id, 'run-1')
    assert.equal(result.sources[0].openDraftBatch.id, 'batch-1')
    assert.equal(result.sources[0].latestRun.crawlCoverage.completeness, 'PARTIAL')
    assert.equal(
        result.sources[0].latestRun.crawlCoverage.mismatchStatus,
        'REPORTED_TOTAL_EXCEEDS_EXTRACTED',
    )
    assert.equal(
        result.sources[0].latestRun.crawlCoverage.operatorPolicy.code,
        'RESUME_FROM_CHECKPOINT',
    )
    assert.equal(result.queueHealth.configured, true)
    assert.equal(result.workerHealth.processors.length, 1)

    restoreModules()
})

test('review ops batch readiness reports publish blockers and crawl validation issues', async () => {
    restoreModules()

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReviewSync: ({ rating }) => ({
            label: rating >= 4 ? 'POSITIVE' : 'NEGATIVE',
            keywords: [],
        }),
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findBatchById: async () => ({
            id: 'batch-1',
            restaurantId: 'restaurant-1',
            createdByUserId: 'user-1',
            crawlSourceId: 'source-1',
            title: 'Google Maps crawl',
            sourceType: 'GOOGLE_MAPS_CRAWL',
            status: 'IN_REVIEW',
            publishedAt: null,
            createdAt: new Date('2026-03-24T00:00:00Z'),
            updatedAt: new Date('2026-03-24T00:05:00Z'),
            items: [
                {
                    id: 'item-1',
                    batchId: 'batch-1',
                    restaurantId: 'restaurant-1',
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:a',
                    rawAuthorName: 'Ana',
                    rawRating: 5,
                    rawContent: 'Great pho',
                    rawReviewDate: new Date('2026-03-20T00:00:00Z'),
                    normalizedAuthorName: 'Ana',
                    normalizedRating: 5,
                    normalizedContent: 'Great pho',
                    normalizedReviewDate: new Date('2026-03-20T00:00:00Z'),
                    approvalStatus: 'PENDING',
                    canonicalReviewId: null,
                },
                {
                    id: 'item-2',
                    batchId: 'batch-1',
                    restaurantId: 'restaurant-1',
                    sourceProvider: 'GOOGLE_MAPS',
                    sourceExternalId: 'google-maps:review:b',
                    rawAuthorName: null,
                    rawRating: 4,
                    rawContent: null,
                    rawReviewDate: null,
                    normalizedAuthorName: null,
                    normalizedRating: 4,
                    normalizedContent: null,
                    normalizedReviewDate: null,
                    approvalStatus: 'APPROVED',
                    canonicalReviewId: null,
                },
            ],
        }),
    })
    withMock('../src/modules/review-crawl/review-crawl.repository', {
        listSourceRawReviewsSince: async () => [
            {
                id: 'raw-1',
                validForIntake: false,
                validationIssues: [{ code: 'INTAKE_INVALID_CONTENT' }],
            },
            {
                id: 'raw-2',
                validForIntake: false,
                validationIssues: ['INTAKE_INVALID_CONTENT', 'INTAKE_INVALID_REVIEW_DATE'],
            },
        ],
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        getRedisConnection: () => null,
        getReviewCrawlJob: async () => null,
        getReviewCrawlQueueHealth: async () => ({ configured: false, counts: null }),
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        readReviewCrawlWorkerHealth: async () => ({
            configured: false,
            scheduler: null,
            processors: [],
        }),
    })

    const service = require('../src/modules/review-ops/review-ops.service')
    const result = await service.getBatchReadiness({
        userId: 'user-1',
        batchId: 'batch-1',
    })

    assert.equal(result.bulkApprovableCount, 1)
    assert.equal(result.publishAllowed, false)
    assert.equal(result.blockingReasons[0].code, 'APPROVED_ITEM_INVALID')
    assert.equal(result.crawlDiagnostics.skippedInvalidCount, 2)
    assert.deepEqual(result.crawlDiagnostics.topValidationIssues[0], {
        code: 'INTAKE_INVALID_CONTENT',
        count: 2,
    })

    restoreModules()
})

test('review ops approve-valid only approves publishable pending items', async () => {
    restoreModules()

    let updatedItems = null
    let updatedBatchStatus = null
    let batchReadCount = 0

    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({ restaurantId: 'restaurant-1', permission: 'OWNER' }),
    })
    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReviewSync: ({ rating }) => ({
            label: rating >= 4 ? 'POSITIVE' : 'NEGATIVE',
            keywords: [],
        }),
    })
    withMock('../src/modules/admin-intake/admin-intake.repository', {
        findBatchById: async () => {
            batchReadCount += 1

            if (batchReadCount > 1) {
                return {
                    id: 'batch-1',
                    restaurantId: 'restaurant-1',
                    createdByUserId: 'user-1',
                    crawlSourceId: 'source-1',
                    title: 'Google Maps crawl',
                    sourceType: 'GOOGLE_MAPS_CRAWL',
                    status: 'IN_REVIEW',
                    publishedAt: null,
                    createdAt: new Date('2026-03-24T00:00:00Z'),
                    updatedAt: new Date('2026-03-24T00:05:00Z'),
                    items: [
                        {
                            id: 'item-1',
                            batchId: 'batch-1',
                            restaurantId: 'restaurant-1',
                            rawAuthorName: 'Ana',
                            rawRating: 5,
                            rawContent: 'Great pho',
                            rawReviewDate: new Date('2026-03-20T00:00:00Z'),
                            normalizedAuthorName: 'Ana',
                            normalizedRating: 5,
                            normalizedContent: 'Great pho',
                            normalizedReviewDate: new Date('2026-03-20T00:00:00Z'),
                            approvalStatus: 'APPROVED',
                            reviewerNote: 'bulk-approved',
                            canonicalReviewId: null,
                            createdAt: new Date('2026-03-24T00:00:00Z'),
                            updatedAt: new Date('2026-03-24T00:05:00Z'),
                        },
                        {
                            id: 'item-2',
                            batchId: 'batch-1',
                            restaurantId: 'restaurant-1',
                            rawAuthorName: null,
                            rawRating: 4,
                            rawContent: null,
                            rawReviewDate: null,
                            normalizedAuthorName: null,
                            normalizedRating: 4,
                            normalizedContent: null,
                            normalizedReviewDate: null,
                            approvalStatus: 'PENDING',
                            reviewerNote: null,
                            canonicalReviewId: null,
                            createdAt: new Date('2026-03-24T00:00:00Z'),
                            updatedAt: new Date('2026-03-24T00:05:00Z'),
                        },
                    ],
                }
            }

            return {
                id: 'batch-1',
                restaurantId: 'restaurant-1',
                createdByUserId: 'user-1',
                crawlSourceId: 'source-1',
                title: 'Google Maps crawl',
                sourceType: 'GOOGLE_MAPS_CRAWL',
                status: 'DRAFT',
                publishedAt: null,
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:05:00Z'),
                items: [
                    {
                        id: 'item-1',
                        batchId: 'batch-1',
                        restaurantId: 'restaurant-1',
                        rawAuthorName: 'Ana',
                        rawRating: 5,
                        rawContent: 'Great pho',
                        rawReviewDate: new Date('2026-03-20T00:00:00Z'),
                        normalizedAuthorName: 'Ana',
                        normalizedRating: 5,
                        normalizedContent: 'Great pho',
                        normalizedReviewDate: new Date('2026-03-20T00:00:00Z'),
                        approvalStatus: 'PENDING',
                        reviewerNote: null,
                        canonicalReviewId: null,
                        createdAt: new Date('2026-03-24T00:00:00Z'),
                        updatedAt: new Date('2026-03-24T00:05:00Z'),
                    },
                    {
                        id: 'item-2',
                        batchId: 'batch-1',
                        restaurantId: 'restaurant-1',
                        rawAuthorName: null,
                        rawRating: 4,
                        rawContent: null,
                        rawReviewDate: null,
                        normalizedAuthorName: null,
                        normalizedRating: 4,
                        normalizedContent: null,
                        normalizedReviewDate: null,
                        approvalStatus: 'PENDING',
                        reviewerNote: null,
                        canonicalReviewId: null,
                        createdAt: new Date('2026-03-24T00:00:00Z'),
                        updatedAt: new Date('2026-03-24T00:05:00Z'),
                    },
                ],
            }
        },
        updateItemsMany: async (itemIds, data) => {
            updatedItems = { itemIds, data }
            return { count: itemIds.length }
        },
        updateBatch: async (_batchId, data) => {
            updatedBatchStatus = data.status
            return {
                id: 'batch-1',
                restaurantId: 'restaurant-1',
                createdByUserId: 'user-1',
                crawlSourceId: 'source-1',
                title: 'Google Maps crawl',
                sourceType: 'GOOGLE_MAPS_CRAWL',
                status: data.status,
                publishedAt: null,
                createdAt: new Date('2026-03-24T00:00:00Z'),
                updatedAt: new Date('2026-03-24T00:05:00Z'),
                items: [],
            }
        },
    })

    const service = require('../src/modules/review-ops/review-ops.service')
    const result = await service.approveValidBatchItems({
        userId: 'user-1',
        batchId: 'batch-1',
        reviewerNote: 'bulk-approved',
    })

    assert.deepEqual(updatedItems.itemIds, ['item-1'])
    assert.equal(updatedItems.data.approvalStatus, 'APPROVED')
    assert.equal(updatedItems.data.reviewerNote, 'bulk-approved')
    assert.equal(updatedBatchStatus, null)
    assert.equal(result.approvedCount, 1)
    assert.equal(result.skippedCount, 1)
    assert.equal(result.batch.status, 'IN_REVIEW')

    restoreModules()
})
