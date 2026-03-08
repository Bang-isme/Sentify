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
    clearModule('../src/services/review-import-run.service')
    clearModule('../src/lib/prisma')
    clearModule('../src/services/restaurant-access.service')
    clearModule('../src/services/review-import.service')
}

test('review import run service queues a new run and schedules background work', async () => {
    restoreModules()

    let createdRun = null
    let scheduledCallback = null
    const originalSetImmediate = global.setImmediate
    global.setImmediate = (callback) => {
        scheduledCallback = callback
        return 1
    }

    withMock('../src/lib/prisma', {
        importRun: {
            findFirst: async () => null,
            create: async ({ data }) => {
                createdRun = {
                    id: 'run-1',
                    imported: 0,
                    skipped: 0,
                    total: 0,
                    createdAt: new Date('2026-03-09T00:00:00Z'),
                    updatedAt: new Date('2026-03-09T00:00:00Z'),
                    ...data,
                }
                return createdRun
            },
        },
    })
    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({
            restaurant: {
                googleMapUrl: 'https://www.google.com/maps/place/The+59+cafe',
            },
        }),
    })
    withMock('../src/services/review-import.service', {
        importReviews: async () => ({
            imported: 0,
            skipped: 0,
            total: 0,
            scrape: {
                source: 'google-maps-browser',
                advertisedTotalReviews: null,
                collectedReviewCount: 0,
                targetReviewCount: 320,
                explicitTarget: null,
                hardMaxReviews: 320,
                reachedRequestedTarget: false,
                reachedEndOfFeed: false,
                coveragePercentage: null,
                isCompleteSync: false,
            },
            message: 'done',
        }),
    })

    const service = require('../src/services/review-import-run.service')
    const result = await service.queueImportRun({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
    })

    assert.equal(result.queued, true)
    assert.equal(result.alreadyActive, false)
    assert.equal(result.run?.status, 'QUEUED')
    assert.equal(createdRun?.restaurantId, 'restaurant-1')
    assert.equal(typeof scheduledCallback, 'function')

    global.setImmediate = originalSetImmediate
    restoreModules()
})

test('review import run service returns the existing active run instead of creating a duplicate', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        importRun: {
            findFirst: async () => ({
                id: 'run-1',
                restaurantId: 'restaurant-1',
                status: 'RUNNING',
                imported: 12,
                skipped: 4,
                total: 16,
                scrapeSource: 'google-maps-browser',
                advertisedTotalReviews: null,
                collectedReviewCount: 16,
                targetReviewCount: 320,
                explicitTarget: null,
                hardMaxReviews: 320,
                reachedRequestedTarget: false,
                reachedEndOfFeed: false,
                coveragePercentage: null,
                isCompleteSync: false,
                message: 'Import is running.',
                errorCode: null,
                errorMessage: null,
                errorDetails: null,
                startedAt: new Date('2026-03-09T00:00:00Z'),
                completedAt: null,
                failedAt: null,
                createdAt: new Date('2026-03-09T00:00:00Z'),
                updatedAt: new Date('2026-03-09T00:00:01Z'),
            }),
        },
    })
    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({
            restaurant: {
                googleMapUrl: 'https://www.google.com/maps/place/The+59+cafe',
            },
        }),
    })
    withMock('../src/services/review-import.service', {
        importReviews: async () => {
            throw new Error('should not run sync import here')
        },
    })

    const service = require('../src/services/review-import-run.service')
    const result = await service.queueImportRun({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
    })

    assert.equal(result.queued, false)
    assert.equal(result.alreadyActive, true)
    assert.equal(result.run?.id, 'run-1')

    restoreModules()
})

test('review import run service lists recent runs in descending order and clamps the limit', async () => {
    restoreModules()

    let receivedTake = null
    withMock('../src/lib/prisma', {
        importRun: {
            findMany: async ({ take }) => {
                receivedTake = take
                return [
                    {
                        id: 'run-2',
                        restaurantId: 'restaurant-1',
                        requestedByUserId: 'user-1',
                        status: 'COMPLETED',
                        phase: 'COMPLETED',
                        progressPercent: 100,
                        imported: 32,
                        skipped: 8,
                        total: 40,
                        scrapeSource: 'google-maps-browser',
                        advertisedTotalReviews: 286,
                        collectedReviewCount: 269,
                        targetReviewCount: 286,
                        explicitTarget: null,
                        hardMaxReviews: 640,
                        reachedRequestedTarget: false,
                        reachedEndOfFeed: true,
                        coveragePercentage: 94.1,
                        isCompleteSync: false,
                        message: 'Import completed.',
                        errorCode: null,
                        errorMessage: null,
                        errorDetails: null,
                        startedAt: new Date('2026-03-09T01:00:00Z'),
                        completedAt: new Date('2026-03-09T01:04:00Z'),
                        failedAt: null,
                        createdAt: new Date('2026-03-09T01:00:00Z'),
                        updatedAt: new Date('2026-03-09T01:04:00Z'),
                    },
                    {
                        id: 'run-1',
                        restaurantId: 'restaurant-1',
                        requestedByUserId: 'user-1',
                        status: 'FAILED',
                        phase: 'FAILED',
                        progressPercent: 100,
                        imported: 0,
                        skipped: 0,
                        total: 0,
                        scrapeSource: 'google-maps-browser',
                        advertisedTotalReviews: null,
                        collectedReviewCount: 0,
                        targetReviewCount: 320,
                        explicitTarget: null,
                        hardMaxReviews: 640,
                        reachedRequestedTarget: false,
                        reachedEndOfFeed: false,
                        coveragePercentage: null,
                        isCompleteSync: false,
                        message: 'Import failed.',
                        errorCode: 'SCRAPE_FAILED',
                        errorMessage: 'Maps blocked the review feed.',
                        errorDetails: null,
                        startedAt: new Date('2026-03-08T01:00:00Z'),
                        completedAt: null,
                        failedAt: new Date('2026-03-08T01:01:00Z'),
                        createdAt: new Date('2026-03-08T01:00:00Z'),
                        updatedAt: new Date('2026-03-08T01:01:00Z'),
                    },
                ]
            },
        },
    })
    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({
            restaurant: {
                googleMapUrl: 'https://www.google.com/maps/place/The+59+cafe',
            },
        }),
    })
    withMock('../src/services/review-import.service', {
        importReviews: async () => {
            throw new Error('should not import during history listing')
        },
    })

    const service = require('../src/services/review-import-run.service')
    const result = await service.listImportRuns({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        limit: 99,
    })

    assert.equal(receivedTake, 20)
    assert.equal(result.length, 2)
    assert.equal(result[0].id, 'run-2')
    assert.equal(result[0].phase, 'COMPLETED')
    assert.equal(result[1].status, 'FAILED')

    restoreModules()
})
