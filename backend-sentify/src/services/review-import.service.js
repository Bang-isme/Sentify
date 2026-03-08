const prisma = require('../lib/prisma')
const { badRequest } = require('../lib/app-error')
const { recalculateRestaurantInsights } = require('./insight.service')
const { getRestaurantAccess } = require('./restaurant-access.service')
const { scrapeGoogleReviewsWithBrowser } = require('./google-browser-review-tool.service')
const { analyzeReview } = require('./sentiment-analyzer.service')

async function importReviews({ userId, restaurantId }) {
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

    const scrapedReviews = await scrapeGoogleReviewsWithBrowser({
        googleMapUrl: access.restaurant.googleMapUrl,
        restaurantName: access.restaurant.name,
        restaurantAddress: access.restaurant.address,
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
    const reviewsToCreate = []

    for (const review of scrapedReviews) {
        // Dedup stays at the application layer first, then the DB unique key acts as the final guard.
        if (existingExternalIds.has(review.externalId)) {
            continue
        }

        const analysis = await analyzeReview({
            content: review.content,
            rating: review.rating,
        })

        reviewsToCreate.push({
            restaurantId,
            externalId: review.externalId,
            authorName: review.authorName,
            rating: review.rating,
            content: review.content,
            sentiment: analysis.label,
            reviewDate: review.reviewDate,
        })
    }

    if (reviewsToCreate.length > 0) {
        await prisma.review.createMany({
            data: reviewsToCreate,
        })
    }

    // Rebuild cached insight tables after every import so dashboard reads stay simple and fast.
    await recalculateRestaurantInsights({
        restaurantId,
    })

    const imported = reviewsToCreate.length
    const total = scrapedReviews.length
    const skipped = total - imported

    return {
        imported,
        skipped,
        total,
        message: `Successfully imported ${imported} new reviews, ${skipped} duplicates skipped.`,
    }
}

module.exports = {
    importReviews,
}
