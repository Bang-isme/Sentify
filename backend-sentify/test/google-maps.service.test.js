const test = require('node:test')
const assert = require('node:assert/strict')

const {
    determineCrawlCompleteness,
    fetchGoogleMapsReviewPage,
    fetchText,
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

test('google maps service retries transient text fetch failures before succeeding', async () => {
    const originalFetch = global.fetch
    const calls = []

    global.fetch = async (url) => {
        calls.push(url)

        if (calls.length === 1) {
            throw new TypeError('fetch failed')
        }

        return {
            ok: true,
            url,
            text: async () => '<html>ok</html>',
        }
    }

    try {
        const result = await fetchText('https://maps.app.goo.gl/demo', {}, {
            retryDelaysMs: [0],
        })

        assert.equal(result.url, 'https://maps.app.goo.gl/demo')
        assert.equal(result.text, '<html>ok</html>')
        assert.equal(calls.length, 2)
    } finally {
        global.fetch = originalFetch
    }
})

test('google maps service does not retry non-retryable upstream status failures', async () => {
    const originalFetch = global.fetch
    let calls = 0

    global.fetch = async (url) => {
        calls += 1

        return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            url,
            text: async () => '',
        }
    }

    try {
        await assert.rejects(
            () =>
                fetchText('https://www.google.com/maps/invalid', {}, {
                    retryDelaysMs: [0, 0],
                }),
            (error) => {
                assert.equal(error.code, 'GOOGLE_MAPS_FETCH_FAILED')
                assert.equal(error.details?.retryable, false)
                assert.equal(calls, 1)
                return true
            },
        )
    } finally {
        global.fetch = originalFetch
    }
})

test('google maps service forwards timeout abort signals to browser-like clients', async () => {
    let receivedSignal = null
    let aborted = false

    const client = {
        fetch: async (_url, init = {}) =>
            new Promise((resolve, reject) => {
                receivedSignal = init.signal ?? null
                init.signal?.addEventListener(
                    'abort',
                    () => {
                        aborted = true
                        reject(new Error('client aborted'))
                    },
                    { once: true },
                )
            }),
    }

    await assert.rejects(
        () =>
            fetchText('https://maps.app.goo.gl/demo', {}, {
                client,
                timeoutMs: 10,
                retryDelaysMs: [],
            }),
        (error) => {
            assert.equal(error.code, 'GOOGLE_MAPS_FETCH_FAILED')
            assert.equal(error.details?.retryable, true)
            assert.equal(receivedSignal instanceof AbortSignal, true)
            assert.equal(aborted, true)
            return true
        },
    )
})

test('google maps review page fetch aborts hanging browser-like requests after the timeout budget', async () => {
    let aborted = false

    const client = {
        fetch: async (_url, init = {}) =>
            new Promise((resolve, reject) => {
                init.signal?.addEventListener(
                    'abort',
                    () => {
                        aborted = true
                        reject(new Error('client aborted'))
                    },
                    { once: true },
                )
            }),
    }

    await assert.rejects(
        () =>
            fetchGoogleMapsReviewPage({
                client,
                placeHexId: '0x123:0x456',
                sessionToken: 'session-token',
                sort: 'relevant',
                nextPageToken: null,
                searchQuery: null,
                pageSize: 20,
                language: 'en',
                region: 'us',
                timeoutMs: 10,
            }),
        (error) => {
            assert.equal(error.code, 'GOOGLE_MAPS_REVIEW_FETCH_FAILED')
            assert.equal(error.details?.retryable, true)
            assert.equal(aborted, true)
            return true
        },
    )
})
