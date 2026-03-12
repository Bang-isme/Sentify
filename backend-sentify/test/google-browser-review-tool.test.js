const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function loadEnv() {
    clearModule('../src/config/env')
    return require('../src/config/env')
}

function loadBrowserReviewTool() {
    clearModule('../src/config/env')
    clearModule('../src/services/google-browser-review-tool.service')
    return require('../src/services/google-browser-review-tool.service').__private
}

test('browser env auto-normalizes a profile subdirectory into user data root plus profile name', () => {
    process.env.REVIEW_BROWSER_USER_DATA_DIR =
        'C:\\Users\\tranb\\AppData\\Local\\Google\\Chrome\\User Data\\Default'
    delete process.env.REVIEW_BROWSER_PROFILE_DIRECTORY

    const env = loadEnv()

    assert.equal(
        env.REVIEW_BROWSER_USER_DATA_DIR_ROOT,
        'C:\\Users\\tranb\\AppData\\Local\\Google\\Chrome\\User Data',
    )
    assert.equal(env.REVIEW_BROWSER_PROFILE_DIRECTORY_VALUE, 'Default')
})

test('browser env respects an explicit profile directory when user data root is provided directly', () => {
    process.env.REVIEW_BROWSER_USER_DATA_DIR =
        'C:\\Users\\tranb\\AppData\\Local\\Google\\Chrome\\User Data'
    process.env.REVIEW_BROWSER_PROFILE_DIRECTORY = 'Profile 1'

    const env = loadEnv()

    assert.equal(
        env.REVIEW_BROWSER_USER_DATA_DIR_ROOT,
        'C:\\Users\\tranb\\AppData\\Local\\Google\\Chrome\\User Data',
    )
    assert.equal(env.REVIEW_BROWSER_PROFILE_DIRECTORY_VALUE, 'Profile 1')
})

test('browser review tool rewrites automation URLs to enforce a stable language', () => {
    process.env.REVIEW_BROWSER_LANGUAGE_CODE = 'en'
    const { buildAutomationUrl } = loadBrowserReviewTool()
    const browserUrl = new URL(buildAutomationUrl('https://www.google.com/maps/place/Th+59+cafe'))

    assert.equal(browserUrl.hostname, 'www.google.com')
    assert.equal(browserUrl.searchParams.get('hl'), 'en')
})

test('browser review tool builds a search fallback URL from restaurant identity', () => {
    process.env.REVIEW_BROWSER_LANGUAGE_CODE = 'en'
    const { buildSearchFallbackUrl } = loadBrowserReviewTool()
    const fallbackUrl = new URL(buildSearchFallbackUrl('The 59 cafe', '59 Hải Phòng'))

    assert.equal(fallbackUrl.pathname, '/maps/search/')
    assert.equal(fallbackUrl.searchParams.get('api'), '1')
    assert.match(fallbackUrl.searchParams.get('query') || '', /The 59 cafe/i)
    assert.equal(fallbackUrl.searchParams.get('hl'), 'en')
})

test('browser review tool detects unresolved place URLs that lost the place identity', () => {
    const { isUnresolvedPlaceUrl } = loadBrowserReviewTool()

    assert.equal(
        isUnresolvedPlaceUrl(
            'https://www.google.com/maps/place//@16.0717637,108.214946,17z?hl=en',
        ),
        true,
    )
    assert.equal(
        isUnresolvedPlaceUrl(
            'https://www.google.com/maps/place/The+59+cafe/@16.0717586,108.2175209,17z',
        ),
        false,
    )
})

test('browser review tool can detect when the page has already resolved the restaurant identity', async () => {
    const { pageHasRestaurantIdentity } = loadBrowserReviewTool()
    const page = {
        title: async () => 'Google Maps - The 59 cafe',
        locator: () => ({
            evaluate: async () => false,
        }),
    }

    await assert.doesNotReject(() => pageHasRestaurantIdentity(page, 'The 59 cafe'))
    assert.equal(await pageHasRestaurantIdentity(page, 'The 59 cafe'), true)
})

test('browser review tool can detect when the page has not resolved the restaurant identity yet', async () => {
    const { pageHasRestaurantIdentity } = loadBrowserReviewTool()
    const page = {
        title: async () => 'Google Maps',
        locator: () => ({
            evaluate: async (_fn, normalizedName) =>
                'directions save nearby'.includes(normalizedName),
        }),
    }

    assert.equal(await pageHasRestaurantIdentity(page, 'The 59 cafe'), false)
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

test('browser review tool parses star labels and relative dates consistently across locales', () => {
    const { extractRatingFromLabel, parseReviewDateLabel } = loadBrowserReviewTool()
    const now = new Date('2026-03-08T00:00:00Z')

    assert.equal(extractRatingFromLabel('4 stars'), 4)
    assert.equal(extractRatingFromLabel('4,0 sao'), 4)
    assert.equal(
        parseReviewDateLabel('2 weeks ago', now)?.toISOString(),
        '2026-02-22T00:00:00.000Z',
    )
    assert.equal(
        parseReviewDateLabel('2 tuần trước', now)?.toISOString(),
        '2026-02-22T00:00:00.000Z',
    )
    assert.equal(
        parseReviewDateLabel('2 週間前', now)?.toISOString(),
        '2026-02-22T00:00:00.000Z',
    )
    assert.equal(
        parseReviewDateLabel('Đã chỉnh sửa 2 năm trước', now)?.toISOString(),
        '2024-03-08T00:00:00.000Z',
    )
    assert.equal(
        parseReviewDateLabel('編集済み 2 年前', now)?.toISOString(),
        '2024-03-08T00:00:00.000Z',
    )
})

test('browser review tool parses advertised review counts from english, vietnamese, and japanese labels', () => {
    const { extractReviewCountFromText } = loadBrowserReviewTool()

    assert.equal(extractReviewCountFromText('286 reviews'), 286)
    assert.equal(extractReviewCountFromText('286 b\u00e0i vi\u1ebft'), 286)
    assert.equal(extractReviewCountFromText('286 b\u00e0i \u0111\u00e1nh gi\u00e1'), 286)
    assert.equal(extractReviewCountFromText('286 \u4ef6\u306e\u53e3\u30b3\u30df'), 286)
})

test('browser review tool uses auto-target mode when max reviews is zero', () => {
    process.env.REVIEW_BROWSER_MAX_REVIEWS = '0'
    process.env.REVIEW_BROWSER_HARD_MAX_REVIEWS = '400'
    const { buildReviewCollectionPlan } = loadBrowserReviewTool()

    const plan = buildReviewCollectionPlan({
        advertisedTotalReviews: 286,
    })

    assert.equal(plan.explicitTarget, null)
    assert.equal(plan.targetReviewCount, 286)
    assert.equal(plan.hardMaxReviews, 400)
})

test('browser review tool still respects a hard safety ceiling in auto-target mode', () => {
    process.env.REVIEW_BROWSER_MAX_REVIEWS = '0'
    process.env.REVIEW_BROWSER_HARD_MAX_REVIEWS = '200'
    const { buildReviewCollectionPlan } = loadBrowserReviewTool()

    const plan = buildReviewCollectionPlan({
        advertisedTotalReviews: 286,
    })

    assert.equal(plan.targetReviewCount, 200)
})

test('browser review tool switches to a recent-first target for incremental sync', () => {
    process.env.REVIEW_BROWSER_MAX_REVIEWS = '0'
    process.env.REVIEW_BROWSER_HARD_MAX_REVIEWS = '320'
    process.env.REVIEW_BROWSER_RECENT_SYNC_TARGET = '120'
    const { buildReviewCollectionPlan } = loadBrowserReviewTool()

    const plan = buildReviewCollectionPlan({
        advertisedTotalReviews: 286,
        smartSyncEnabled: true,
    })

    assert.equal(plan.strategy, 'INCREMENTAL')
    assert.equal(plan.targetReviewCount, 120)
})

test('browser review tool keeps explicit target overrides ahead of smart incremental mode', () => {
    process.env.REVIEW_BROWSER_MAX_REVIEWS = '180'
    process.env.REVIEW_BROWSER_HARD_MAX_REVIEWS = '320'
    process.env.REVIEW_BROWSER_RECENT_SYNC_TARGET = '120'
    const { buildReviewCollectionPlan } = loadBrowserReviewTool()

    const plan = buildReviewCollectionPlan({
        advertisedTotalReviews: 286,
        smartSyncEnabled: true,
    })

    assert.equal(plan.strategy, 'FULL')
    assert.equal(plan.explicitTarget, 180)
    assert.equal(plan.targetReviewCount, 180)
})

test('browser review tool respects explicit target overrides passed by the importer', () => {
    process.env.REVIEW_BROWSER_MAX_REVIEWS = '0'
    process.env.REVIEW_BROWSER_HARD_MAX_REVIEWS = '320'
    const { buildReviewCollectionPlan } = loadBrowserReviewTool()

    const plan = buildReviewCollectionPlan({
        advertisedTotalReviews: 286,
        smartSyncEnabled: true,
        explicitTargetOverride: 24,
        strategyOverride: 'INCREMENTAL',
    })

    assert.equal(plan.strategy, 'INCREMENTAL')
    assert.equal(plan.explicitTarget, 24)
    assert.equal(plan.targetReviewCount, 24)
})

test('browser review tool extracts inline network reviews from Google Maps payloads', () => {
    const { extractRawNetworkReviewsFromPayloadText } = loadBrowserReviewTool()
    const payload = `)]}'
${JSON.stringify([
    null,
    [
        [
            'CIHMtestreviewid',
            [
                null,
                null,
                null,
                null,
                [
                    null,
                    null,
                    ['https://www.google.com/maps/contrib/123/reviews?hl=en'],
                    null,
                    null,
                    [
                        'Alice Nguyen',
                        'https://lh3.googleusercontent.com/avatar',
                        ['https://www.google.com/maps/contrib/123?hl=en'],
                        '123',
                    ],
                ],
                null,
                '2 weeks ago',
            ],
            [[5], null, [[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, ['Friendly staff and very fast service. The coffee was good and the shop stayed quiet enough for working.']]]],
            null,
            [null, null, null, ['https://www.google.com/maps/reviews/data=!reviewshare?hl=en']],
        ],
    ],
])}`

    const reviews = extractRawNetworkReviewsFromPayloadText(payload)

    assert.equal(reviews.length, 1)
    assert.equal(reviews[0].externalId, 'CIHMtestreviewid')
    assert.equal(reviews[0].authorName, 'Alice Nguyen')
    assert.equal(reviews[0].rating, 5)
    assert.equal(reviews[0].reviewDateLabel, '2 weeks ago')
    assert.match(reviews[0].content, /friendly staff/i)
})

test('browser review tool uses a tighter scroll budget for recent-first incremental sync', () => {
    process.env.REVIEW_BROWSER_SCROLL_STEPS = '24'
    process.env.REVIEW_BROWSER_STALL_LIMIT = '6'
    const { computeScrollPassBudget } = loadBrowserReviewTool()

    const incrementalBudget = computeScrollPassBudget({
        strategy: 'INCREMENTAL',
        targetReviewCount: 60,
    })
    const fullBudget = computeScrollPassBudget({
        strategy: 'FULL',
        targetReviewCount: 60,
    })

    assert.equal(incrementalBudget, 24)
    assert.equal(fullBudget, 60)
    assert.ok(incrementalBudget < fullBudget)
})

test('browser review tool chooses the most plausible advertised count once reviews are collected', () => {
    const { pickAdvertisedReviewCount } = loadBrowserReviewTool()

    assert.equal(pickAdvertisedReviewCount([286, 43286], 269), 286)
    assert.equal(pickAdvertisedReviewCount([120, 180], 190), 180)
})

test('browser review tool normalizes reviews and removes duplicates without damaging unicode text', () => {
    const { normalizeBrowserReviews } = loadBrowserReviewTool()
    const reviews = normalizeBrowserReviews([
        {
            externalId: 'review-1',
            authorName: 'Nguyễn Ánh',
            ratingLabel: '5 stars',
            content: 'Phục vụ rất nhanh và sạch sẽ.',
            reviewDateLabel: 'Mar 1, 2026',
        },
        {
            externalId: 'review-1',
            authorName: 'Nguyễn Ánh',
            ratingLabel: '5 stars',
            content: 'Phục vụ rất nhanh và sạch sẽ.',
            reviewDateLabel: 'Mar 1, 2026',
        },
        {
            authorName: '山田 太郎',
            ratingLabel: '2 stars',
            content: '接客が遅い。料理がぬるい。',
            reviewDateLabel: '2 週間前',
        },
    ])

    assert.equal(reviews.length, 2)
    assert.equal(reviews[0].authorName, 'Nguyễn Ánh')
    assert.equal(reviews[1].authorName, '山田 太郎')
    assert.equal(reviews[1].content, '接客が遅い。料理がぬるい。')
    assert.equal(reviews[1].rating, 2)
})

test('browser review tool aborts non-text resources but keeps scripts and xhr requests', () => {
    const { shouldAbortRequest } = loadBrowserReviewTool()

    assert.equal(
        shouldAbortRequest({
            resourceType: () => 'image',
            url: () => 'https://lh3.googleusercontent.com/p/AF1QipImage=s220',
        }),
        true,
    )
    assert.equal(
        shouldAbortRequest({
            resourceType: () => 'font',
            url: () => 'https://fonts.gstatic.com/s/inter/v20.woff2',
        }),
        true,
    )
    assert.equal(
        shouldAbortRequest({
            resourceType: () => 'xhr',
            url: () => 'https://www.google.com/maps/preview/review/listentitiesreviews',
        }),
        false,
    )
    assert.equal(
        shouldAbortRequest({
            resourceType: () => 'script',
            url: () => 'https://maps.googleapis.com/maps-api-v3/api/js/59/1a/main.js',
        }),
        false,
    )
})
