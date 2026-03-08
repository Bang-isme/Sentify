const prisma = require('../lib/prisma')
const { badRequest } = require('../lib/app-error')
const { recalculateRestaurantInsights } = require('./insight.service')
const { getRestaurantAccess } = require('./restaurant-access.service')
const {
    scrapeGoogleReviewsWithBrowserDetailed,
} = require('./google-browser-review-tool.service')
const { analyzeReview } = require('./sentiment-analyzer.service')

const ANALYSIS_BATCH_SIZE = 50

function chunk(values, size) {
    const chunks = []

    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size))
    }

    return chunks
}

async function analyzeReviewsForInsert({ restaurantId, reviews }) {
    const rows = []

    for (const reviewBatch of chunk(reviews, ANALYSIS_BATCH_SIZE)) {
        const analyzedBatch = await Promise.all(
            reviewBatch.map(async (review) => {
                const analysis = await analyzeReview({
                    content: review.content,
                    rating: review.rating,
                })

                return {
                    restaurantId,
                    externalId: review.externalId,
                    authorName: review.authorName,
                    rating: review.rating,
                    content: review.content,
                    sentiment: analysis.label,
                    reviewDate: review.reviewDate,
                }
            }),
        )

        rows.push(...analyzedBatch)
    }

    return rows
}

function buildScrapeSummary(scrapeMetadata, scrapedReviewCount) {
    const advertisedTotalReviews = scrapeMetadata.advertisedTotalReviews ?? null
    const coveragePercentage = advertisedTotalReviews
        ? Number(((scrapedReviewCount / advertisedTotalReviews) * 100).toFixed(1))
        : null

    return {
        source: scrapeMetadata.source,
        advertisedTotalReviews,
        collectedReviewCount: scrapedReviewCount,
        targetReviewCount: scrapeMetadata.targetReviewCount,
        explicitTarget: scrapeMetadata.explicitTarget,
        hardMaxReviews: scrapeMetadata.hardMaxReviews,
        reachedRequestedTarget: scrapeMetadata.reachedRequestedTarget,
        reachedEndOfFeed: scrapeMetadata.reachedEndOfFeed,
        scrollPasses: scrapeMetadata.scrollPasses,
        stalledIterations: scrapeMetadata.stalledIterations,
        coveragePercentage,
        isCompleteSync:
            scrapeMetadata.reachedEndOfFeed &&
            (!advertisedTotalReviews || scrapedReviewCount >= advertisedTotalReviews),
    }
}

async function importReviews({ userId, restaurantId, onProgress }) {
    // Sprint 1 allows both OWNER and MANAGER to run imports for the selected restaurant.
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        allowedPermissions: ['OWNER', 'MANAGER'],
    })

    if (!access.restaurant.googleMapUrl) {
        throw badRequest(
            'MISSING_GOOGLE_MAP_URL',
            'Restaurant must have a Google Maps URL before importing reviews',
        )
    }

    await onProgress?.({
        phase: 'SCRAPING',
        progressPercent: 15,
        message: 'Opening Google Maps and collecting reviews.',
    })

    const { reviews: scrapedReviews, metadata: scrapeMetadata } =
        await scrapeGoogleReviewsWithBrowserDetailed({
            googleMapUrl: access.restaurant.googleMapUrl,
            restaurantName: access.restaurant.name,
            restaurantAddress: access.restaurant.address,
        })

    await onProgress?.({
        phase: 'ANALYZING',
        progressPercent: 55,
        message: `Collected ${scrapedReviews.length} reviews. Analyzing sentiment and duplicates.`,
    })

    const existingReviews = await prisma.review.findMany({
        where: {
            restaurantId,
            externalId: {
                in: scrapedReviews.map((review) => review.externalId),
            },
        },
        select: {
            externalId: true,
        },
    })

    const existingExternalIds = new Set(existingReviews.map((review) => review.externalId))
    const reviewsToAnalyze = scrapedReviews.filter((review) => !existingExternalIds.has(review.externalId))
    const reviewsToCreate = await analyzeReviewsForInsert({
        restaurantId,
        reviews: reviewsToAnalyze,
    })

    await onProgress?.({
        phase: 'PERSISTING',
        progressPercent: 80,
        message: `Persisting ${reviewsToCreate.length} new reviews.`,
    })

    if (reviewsToCreate.length > 0) {
        await prisma.review.createMany({
            data: reviewsToCreate,
        })
    }

    // Rebuild cached insight tables after every import so dashboard reads stay simple and fast.
    await onProgress?.({
        phase: 'REBUILDING',
        progressPercent: 92,
        message: 'Rebuilding dashboard insights from the latest review set.',
    })

    await recalculateRestaurantInsights({
        restaurantId,
    })

    const imported = reviewsToCreate.length
    const total = scrapedReviews.length
    const skipped = total - imported
    const scrape = buildScrapeSummary(scrapeMetadata, total)
    const completenessSuffix = scrape.advertisedTotalReviews
        ? ` Browser sync collected ${total} of ${scrape.advertisedTotalReviews} advertised reviews.`
        : ''

    return {
        imported,
        skipped,
        total,
        scrape,
        message: `Successfully imported ${imported} new reviews, ${skipped} duplicates skipped.${completenessSuffix}`,
    }
}

module.exports = {
    importReviews,
    __private: {
        ANALYSIS_BATCH_SIZE,
        analyzeReviewsForInsert,
        buildScrapeSummary,
    },
}
