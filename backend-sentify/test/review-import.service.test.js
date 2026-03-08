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
        scrapeGoogleReviewsWithBrowserDetailed: async () => ({
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
                targetReviewCount: 286,
                reachedRequestedTarget: false,
                reachedEndOfFeed: false,
                scrollPasses: 28,
                stalledIterations: 2,
            },
        }),
    })
    withMock('../src/services/sentiment-analyzer.service', {
        analyzeReview: async ({ rating }) => ({
            label: rating <= 2 ? 'NEGATIVE' : 'POSITIVE',
            keywords: [],
        }),
    })

    const { importReviews } = require('../src/services/review-import.service')
    const result = await importReviews({
        userId: 'user-1',
        restaurantId: 'restaurant-1',
    })

    assert.equal(insertedRows.length, 1)
    assert.equal(insertedRows[0].externalId, 'review-2')
    assert.equal(recalculatedRestaurantId, 'restaurant-1')
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
