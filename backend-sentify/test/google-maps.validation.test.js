const test = require('node:test')
const assert = require('node:assert/strict')
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'

const {
    createReviewCrawlRunSchema,
    crawlGoogleMapsOptionsSchema,
    crawlGoogleMapsRequestSchema,
    upsertReviewCrawlSourceSchema,
} = require('../src/modules/review-crawl/google-maps.validation')

test('google maps crawl validation accepts a standard place URL', () => {
    const parsed = crawlGoogleMapsOptionsSchema.parse({
        url: 'https://www.google.com/maps/place/Tacombi/@40.748062,-73.985694,17z/data=!4m5!3m4!1s0x89c259a903a8074d:0x85e2e7637cfe73a5!8m2!3d40.748062!4d-73.985694',
    })

    assert.equal(parsed.language, 'en')
    assert.equal(parsed.region, 'us')
    assert.equal(parsed.sort, 'newest')
    assert.equal(parsed.pageSize, 20)
})

test('google maps crawl validation rejects non-google hosts', () => {
    assert.throws(() => {
        crawlGoogleMapsOptionsSchema.parse({
            url: 'https://example.com/maps/place/not-google',
        })
    })
})

test('google maps crawl request validation requires restaurantId for the admin endpoint', () => {
    assert.throws(() => {
        crawlGoogleMapsRequestSchema.parse({
            url: 'https://www.google.com/maps/place/Tacombi/@40.748062,-73.985694,17z/data=!4m5!3m4!1s0x89c259a903a8074d:0x85e2e7637cfe73a5!8m2!3d40.748062!4d-73.985694',
        })
    })
})

test('review crawl source validation accepts sync configuration for Google Maps sources', () => {
    const parsed = upsertReviewCrawlSourceSchema.parse({
        restaurantId: RESTAURANT_ID,
        url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
        syncEnabled: true,
        syncIntervalMinutes: 720,
    })

    assert.equal(parsed.language, 'en')
    assert.equal(parsed.region, 'us')
    assert.equal(parsed.syncEnabled, true)
    assert.equal(parsed.syncIntervalMinutes, 720)
})

test('google maps crawl validation rejects non-uuid restaurant ids on admin endpoints', () => {
    assert.throws(() => {
        crawlGoogleMapsRequestSchema.parse({
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
        })
    })

    assert.throws(() => {
        upsertReviewCrawlSourceSchema.parse({
            restaurantId: 'restaurant-1',
            url: 'https://maps.app.goo.gl/KXqY87PxsQUr6Tmc8',
        })
    })
})

test('review crawl run validation clamps run creation options to supported values', () => {
    const parsed = createReviewCrawlRunSchema.parse({
        strategy: 'BACKFILL',
        priority: 'LOW',
        maxPages: 50,
        pageSize: 20,
        delayMs: 100,
    })

    assert.equal(parsed.strategy, 'BACKFILL')
    assert.equal(parsed.priority, 'LOW')
    assert.equal(parsed.maxPages, 50)
    assert.equal(parsed.pageSize, 20)
    assert.equal(parsed.delayMs, 100)
})
