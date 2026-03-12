const prisma = require('../lib/prisma')
const env = require('../config/env')
const { badRequest } = require('../lib/app-error')
const { recalculateRestaurantInsights } = require('./insight.service')
const { getRestaurantAccess } = require('./restaurant-access.service')
const {
    scrapeGoogleReviewsWithBrowserDetailed,
} = require('./google-browser-review-tool.service')
const { analyzeReviewSync } = require('./sentiment-analyzer.service')

async function analyzeReviewsForInsert({ restaurantId, reviews }) {
    return reviews.map((review) => {
        const analysis = analyzeReviewSync({
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
            keywords: analysis.keywords,
            reviewDate: review.reviewDate,
        }
    })
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

function buildImportMessage({ imported, total, scrape, scrapeMetadata, usedHeadSync = false }) {
    const skipped = Math.max(total - imported, 0)
    const completenessSuffix = scrape.advertisedTotalReviews
        ? ` Browser sync collected ${total} of ${scrape.advertisedTotalReviews} advertised reviews.`
        : ''
    const incrementalSuffix =
        scrapeMetadata.strategy === 'INCREMENTAL' && scrapeMetadata.earlyStopped
            ? ' Recent-first sync stopped once the feed reached a long streak of already-known reviews.'
            : ''
    const headSyncSuffix = usedHeadSync
        ? ' Sentify applied a quick recent-review sync first, then continued with deeper history only because it was still needed.'
        : ''

    return `Successfully imported ${imported} new reviews, ${skipped} duplicates skipped.${completenessSuffix}${incrementalSuffix}${headSyncSuffix}`
}

async function runImportStage({
    restaurantId,
    existingExternalIds,
    googleMapUrl,
    restaurantName,
    restaurantAddress,
    scrapeOptions,
    onProgress,
    progressMessages,
}) {
    if (progressMessages?.scraping) {
        await onProgress?.(progressMessages.scraping)
    }

    const { reviews: scrapedReviews, metadata: scrapeMetadata } =
        await scrapeGoogleReviewsWithBrowserDetailed({
            googleMapUrl,
            restaurantName,
            restaurantAddress,
            knownExternalIds: existingExternalIds,
            ...scrapeOptions,
        })

    if (progressMessages?.analyzing) {
        await onProgress?.({
            ...progressMessages.analyzing,
            message: `Collected ${scrapedReviews.length} reviews. ${progressMessages.analyzing.message}`,
        })
    }

    const reviewsToAnalyze = scrapedReviews.filter((review) => !existingExternalIds.has(review.externalId))
    const reviewsToCreate = await analyzeReviewsForInsert({
        restaurantId,
        reviews: reviewsToAnalyze,
    })

    if (progressMessages?.persisting) {
        await onProgress?.({
            ...progressMessages.persisting,
            message: `Persisting ${reviewsToCreate.length} new reviews.`,
        })
    }

    if (reviewsToCreate.length > 0) {
        await prisma.review.createMany({
            data: reviewsToCreate,
        })

        for (const review of reviewsToCreate) {
            existingExternalIds.add(review.externalId)
        }
    }

    return {
        imported: reviewsToCreate.length,
        skipped: scrapedReviews.length - reviewsToCreate.length,
        total: scrapedReviews.length,
        scrape: buildScrapeSummary(scrapeMetadata, scrapedReviews.length),
        scrapeMetadata,
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

    const existingReviewRows = await prisma.review.findMany({
        where: {
            restaurantId,
        },
        select: {
            externalId: true,
        },
    })
    const existingExternalIds = new Set(existingReviewRows.map((review) => review.externalId))
    const isWarmSync = existingExternalIds.size > 0
    let usedHeadSync = false
    let headStage = null

    if (isWarmSync) {
        usedHeadSync = true
        headStage = await runImportStage({
            restaurantId,
            existingExternalIds,
            googleMapUrl: access.restaurant.googleMapUrl,
            restaurantName: access.restaurant.name,
            restaurantAddress: access.restaurant.address,
            scrapeOptions: {
                explicitTargetOverride: Math.min(
                    env.REVIEW_BROWSER_HEAD_SYNC_TARGET,
                    env.REVIEW_BROWSER_HARD_MAX_REVIEWS,
                ),
                strategyOverride: 'INCREMENTAL',
                preferNewest: true,
            },
            onProgress,
            progressMessages: {
                scraping: {
                    phase: 'SCRAPING',
                    progressPercent: 12,
                    message: 'Opening Google Maps and checking the newest reviews first.',
                },
                analyzing: {
                    phase: 'ANALYZING',
                    progressPercent: 28,
                    message: 'Analyzing sentiment and duplicates in the newest reviews.',
                },
                persisting: {
                    phase: 'PERSISTING',
                    progressPercent: 42,
                },
            },
        })

        if (headStage.imported > 0) {
            await onProgress?.({
                phase: 'REBUILDING',
                progressPercent: 54,
                message: 'Refreshing dashboard insights with the newest reviews first.',
            })
            await recalculateRestaurantInsights({
                restaurantId,
            })
        }

        const canFinishAfterHeadSync =
            headStage.scrapeMetadata.earlyStopped && headStage.imported === 0

        if (canFinishAfterHeadSync) {
            return {
                imported: headStage.imported,
                skipped: headStage.skipped,
                total: headStage.total,
                scrape: headStage.scrape,
                message: buildImportMessage({
                    imported: headStage.imported,
                    total: headStage.total,
                    scrape: headStage.scrape,
                    scrapeMetadata: headStage.scrapeMetadata,
                    usedHeadSync,
                }),
            }
        }
    }

    const deepStage = await runImportStage({
        restaurantId,
        existingExternalIds,
        googleMapUrl: access.restaurant.googleMapUrl,
        restaurantName: access.restaurant.name,
        restaurantAddress: access.restaurant.address,
        scrapeOptions: {
            preferNewest: false,
        },
        onProgress,
        progressMessages: {
            scraping: {
                phase: 'SCRAPING',
                progressPercent: usedHeadSync ? 60 : 15,
                message: usedHeadSync
                    ? 'Recent reviews are synced. Continuing with a deeper history pass.'
                    : 'Opening Google Maps and collecting review history.',
            },
            analyzing: {
                phase: 'ANALYZING',
                progressPercent: usedHeadSync ? 74 : 55,
                message: 'Analyzing sentiment and duplicates.',
            },
            persisting: {
                phase: 'PERSISTING',
                progressPercent: usedHeadSync ? 86 : 80,
            },
        },
    })

    if (deepStage.imported > 0 || !usedHeadSync) {
        await onProgress?.({
            phase: 'REBUILDING',
            progressPercent: 92,
            message: 'Rebuilding dashboard insights from the latest review set.',
        })

        await recalculateRestaurantInsights({
            restaurantId,
        })
    }

    const imported = (headStage?.imported || 0) + deepStage.imported
    const total = deepStage.total
    const skipped = Math.max(total - imported, 0)
    const scrape = deepStage.scrape

    return {
        imported,
        skipped,
        total,
        scrape,
        message: buildImportMessage({
            imported,
            total,
            scrape,
            scrapeMetadata: deepStage.scrapeMetadata,
            usedHeadSync,
        }),
    }
}

module.exports = {
    importReviews,
    __private: {
        analyzeReviewsForInsert,
        buildScrapeSummary,
        buildImportMessage,
        runImportStage,
    },
}
