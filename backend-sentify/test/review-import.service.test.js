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
    clearModule('../src/services/review-import.service')
    clearModule('../src/lib/prisma')
    clearModule('../src/services/insight.service')
    clearModule('../src/services/restaurant-access.service')
    clearModule('../src/services/google-browser-review-tool.service')
    clearModule('../src/services/sentiment-analyzer.service')
}

test('review import service returns honest scrape metadata and imports only new reviews', async () => {
    restoreModules()

    const insertedRows = []
    let recalculatedRestaurantId = null
    let scrapeCallCount = 0

    withMock('../src/lib/prisma', {
        review: {
            findMany: async () => [{ externalId: 'review-1' }],
            createMany: async ({ data }) => {
                insertedRows.push(...data)
            },
        },
    })
    withMock('../src/services/insight.service', {
        recalculateRestaurantInsights: async ({ restaurantId }) => {
            recalculatedRestaurantId = restaurantId
        },
    })
    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({
            restaurant: {
                name: 'The 59 cafe',
                address: '59 Hải Phòng',
                googleMapUrl: 'https://www.google.com/maps/place/The+59+cafe',
            },
        }),
    })
    withMock('../src/services/google-browser-review-tool.service', {
        scrapeGoogleReviewsWithBrowserDetailed: async () => {
            scrapeCallCount += 1

            if (scrapeCallCount === 1) {
                return {
                    reviews: [
                        {
                            externalId: 'review-1',
                            authorName: 'Existing',
                            rating: 5,
                            content: 'Already imported',
                            reviewDate: new Date('2026-03-01T00:00:00Z'),
                        },
                    ],
                    metadata: {
                        source: 'google-maps-browser',
                        advertisedTotalReviews: 286,
                        explicitTarget: 24,
                        hardMaxReviews: 400,
                        strategy: 'INCREMENTAL',
                        targetReviewCount: 24,
                        reachedRequestedTarget: false,
                        reachedEndOfFeed: false,
                        earlyStopped: false,
                        scrollPasses: 6,
                        stalledIterations: 1,
                    },
                }
            }

            return {
                reviews: [
                    {
                        externalId: 'review-1',
                        authorName: 'Existing',
                        rating: 5,
                        content: 'Already imported',
                        reviewDate: new Date('2026-03-01T00:00:00Z'),
                    },
                    {
                        externalId: 'review-2',
                        authorName: 'New review',
                        rating: 2,
                        content: 'Service was slow.',
                        reviewDate: new Date('2026-03-02T00:00:00Z'),
                    },
                ],
                metadata: {
                    source: 'google-maps-browser',
                    advertisedTotalReviews: 286,
                    explicitTarget: null,
                    hardMaxReviews: 400,
                    strategy: 'FULL',
                    targetReviewCount: 286,
                    reachedRequestedTarget: false,
                    reachedEndOfFeed: false,
                    scrollPasses: 28,
                    stalledIterations: 2,
                },
            }
        },
    })
    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReviewSync: ({ rating }) => ({
            label: rating <= 2 ? 'NEGATIVE' : 'POSITIVE',
            keywords: rating <= 2 ? ['slow'] : [],
        }),
    })

    const { importReviews } = require('../src/services/review-import.service')
    const result = await importReviews({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
    })

    assert.equal(insertedRows.length, 1)
    assert.equal(insertedRows[0].externalId, 'review-2')
    assert.deepEqual(insertedRows[0].keywords, ['slow'])
    assert.equal(recalculatedRestaurantId, 'restaurant-1')
    assert.equal(scrapeCallCount, 2)
    assert.equal(result.imported, 1)
    assert.equal(result.skipped, 1)
    assert.equal(result.total, 2)
    assert.equal(result.scrape.advertisedTotalReviews, 286)
    assert.equal(result.scrape.collectedReviewCount, 2)
    assert.equal(result.scrape.coveragePercentage, 0.7)
    assert.equal(result.scrape.isCompleteSync, false)
    assert.match(result.message, /collected 2 of 286 advertised reviews/i)

    restoreModules()
})

test('review import service uses recent-first sync metadata when the restaurant already has reviews', async () => {
    restoreModules()

    let receivedKnownExternalIds = null
    let scrapeCallCount = 0

    withMock('../src/lib/prisma', {
        review: {
            findMany: async () => [{ externalId: 'review-1' }, { externalId: 'review-legacy' }],
            createMany: async () => {},
        },
    })
    withMock('../src/services/insight.service', {
        recalculateRestaurantInsights: async () => {},
    })
    withMock('../src/services/restaurant-access.service', {
        getRestaurantAccess: async () => ({
            restaurant: {
                name: 'The 59 cafe',
                address: '59 Hai Phong',
                googleMapUrl: 'https://www.google.com/maps/place/The+59+cafe',
            },
        }),
    })
    withMock('../src/services/google-browser-review-tool.service', {
        scrapeGoogleReviewsWithBrowserDetailed: async ({ knownExternalIds }) => {
            scrapeCallCount += 1
            receivedKnownExternalIds = knownExternalIds

            return {
                reviews: [
                    {
                        externalId: 'review-1',
                        authorName: 'Existing',
                        rating: 5,
                        content: 'Already imported',
                        reviewDate: new Date('2026-03-01T00:00:00Z'),
                    },
                ],
                metadata: {
                    source: 'google-maps-browser',
                    advertisedTotalReviews: 286,
                    explicitTarget: null,
                    hardMaxReviews: 320,
                    strategy: 'INCREMENTAL',
                    targetReviewCount: 120,
                    reachedRequestedTarget: false,
                    reachedEndOfFeed: false,
                    earlyStopped: true,
                    duplicateStreak: 24,
                    scrollPasses: 12,
                    stalledIterations: 1,
                },
            }
        },
    })
    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReviewSync: ({ rating }) => ({
            label: rating <= 2 ? 'NEGATIVE' : 'POSITIVE',
            keywords: [],
        }),
    })

    const { importReviews } = require('../src/services/review-import.service')
    const result = await importReviews({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
    })

    assert.ok(receivedKnownExternalIds instanceof Set)
    assert.equal(receivedKnownExternalIds.has('review-1'), true)
    assert.equal(receivedKnownExternalIds.has('review-legacy'), true)
    assert.equal(scrapeCallCount, 1)
    assert.match(result.message, /recent-first sync stopped/i)

    restoreModules()
})
