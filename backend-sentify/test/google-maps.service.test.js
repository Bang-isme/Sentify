const test = require('node:test')
const assert = require('node:assert/strict')

const {
    determineCrawlCompleteness,
    shouldRetrySuspiciousEmptyPage,
    validateReviewForIntake,
} = require('../src/modules/review-crawl/google-maps.service')

test('google maps service retries an unexpectedly empty page when the reported total has not been reached', () => {
    const shouldRetry = shouldRetrySuspiciousEmptyPage({
        page: {
            reviews: [],
            nextPageToken: null,
        },
        reportedTotal: 4746,
        searchQuery: undefined,
        extractedCount: 20,
    })

    assert.equal(shouldRetry, true)
})

test('google maps service does not retry an empty page when a search query narrows the result set', () => {
    const shouldRetry = shouldRetrySuspiciousEmptyPage({
        page: {
            reviews: [],
            nextPageToken: null,
        },
        reportedTotal: 4746,
        searchQuery: 'bun bo',
        extractedCount: 0,
    })

    assert.equal(shouldRetry, false)
})

test('google maps service marks premature exhaustion as partial instead of complete', () => {
    const completeness = determineCrawlCompleteness({
        extractedCount: 20,
        exhaustedSource: true,
        prematureExhaustionDetected: true,
    })

    assert.equal(completeness, 'partial')
})

test('google maps service validates a review into an intake-safe payload', () => {
    const validation = validateReviewForIntake({
        reviewId: 'review-1',
        reviewUrl: 'https://www.google.com/maps/review/review-1',
        rating: 5,
        text: 'Great pho and broth',
        publishedAt: '2026-03-20T00:00:00.000Z',
        author: {
            name: 'Ana',
        },
    })

    assert.deepEqual(validation.issues, [])
    assert.equal(validation.warnings.length, 0)
    assert.deepEqual(validation.item, {
        sourceProvider: 'GOOGLE_MAPS',
        sourceExternalId: 'google-maps:review:review-1',
        sourceReviewUrl: 'https://www.google.com/maps/review/review-1',
        rawAuthorName: 'Ana',
        rawRating: 5,
        rawContent: 'Great pho and broth',
        rawReviewDate: '2026-03-20T00:00:00.000Z',
    })
})
