const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function loadBrowserReviewTool() {
    clearModule('../src/config/env')
    clearModule('../src/services/google-browser-review-tool.service')
    return require('../src/services/google-browser-review-tool.service').__private
}

test('browser review tool rewrites automation URLs to enforce a stable language', () => {
    process.env.REVIEW_BROWSER_LANGUAGE_CODE = 'en'
    const { buildAutomationUrl } = loadBrowserReviewTool()
    const browserUrl = new URL(buildAutomationUrl('https://www.google.com/maps/place/Th+59+cafe'))

    assert.equal(browserUrl.hostname, 'www.google.com')
    assert.equal(browserUrl.searchParams.get('hl'), 'en')
})

test('browser review tool keeps the saved Google Maps place URL instead of replacing it with a search query', () => {
    process.env.REVIEW_BROWSER_LANGUAGE_CODE = 'en'
    const { buildAutomationUrl } = loadBrowserReviewTool()
    const browserUrl = new URL(
        buildAutomationUrl(
            'https://www.google.com/maps/place/The+59+cafe/@16.0717637,108.214946,17z/data=!4m14!1m7!3m6!1s0x314219bb28181783:0xdc89976718ec6b96!2sThe+59+cafe!8m2!3d16.0717586!4d108.2175209!16s%2Fg%2F11jdrj84zk',
            'Internal Name That Should Not Override The URL',
            'Some Address',
        ),
    )

    assert.match(browserUrl.pathname, /\/maps\/place\//)
    assert.equal(browserUrl.searchParams.get('api'), null)
    assert.equal(browserUrl.searchParams.get('query'), null)
    assert.equal(browserUrl.searchParams.get('hl'), 'en')
})

test('browser review tool rejects non Google hosts before automation starts', () => {
    process.env.REVIEW_BROWSER_LANGUAGE_CODE = 'en'
    const { buildAutomationUrl } = loadBrowserReviewTool()
    assert.throws(
        () => buildAutomationUrl('https://example.com/not-google'),
        (error) => {
            assert.equal(error.code, 'SCRAPE_FAILED')
            assert.match(error.message, /not a Google Maps URL/i)
            return true
        },
    )
})

test('browser review tool parses star labels and relative dates consistently', () => {
    const { extractRatingFromLabel, parseReviewDateLabel } = loadBrowserReviewTool()
    const now = new Date('2026-03-08T00:00:00Z')

    assert.equal(extractRatingFromLabel('4 stars'), 4)
    assert.equal(extractRatingFromLabel('4,0 sao'), 4)
    assert.equal(
        parseReviewDateLabel('2 weeks ago', now)?.toISOString(),
        '2026-02-22T00:00:00.000Z',
    )
    assert.equal(
        parseReviewDateLabel('a month ago', now)?.toISOString(),
        '2026-02-08T00:00:00.000Z',
    )
    assert.equal(
        parseReviewDateLabel('Edited 2 years ago', now)?.toISOString(),
        '2024-03-08T00:00:00.000Z',
    )
})

test('browser review tool normalizes reviews and removes duplicates', () => {
    const { normalizeBrowserReviews } = loadBrowserReviewTool()
    const reviews = normalizeBrowserReviews([
        {
            externalId: 'review-1',
            authorName: 'Alice',
            ratingLabel: '5 stars',
            content: 'Fast service.',
            reviewDateLabel: 'Mar 1, 2026',
        },
        {
            externalId: 'review-1',
            authorName: 'Alice',
            ratingLabel: '5 stars',
            content: 'Fast service.',
            reviewDateLabel: 'Mar 1, 2026',
        },
        {
            authorName: 'Bob',
            ratingLabel: '2 stars',
            content: 'Food came late.',
            reviewDateLabel: '2 weeks ago',
        },
    ])

    assert.equal(reviews.length, 2)
    assert.equal(reviews[0].externalId, 'review-1')
    assert.equal(reviews[1].rating, 2)
    assert.equal(reviews[1].authorName, 'Bob')
})
