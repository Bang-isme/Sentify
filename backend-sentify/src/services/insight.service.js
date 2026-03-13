const prisma = require('../lib/prisma')
const { roundNumber, toPercentage } = require('../lib/math')
const { extractComplaintKeywords } = require('./sentiment-analyzer.service')

function buildInsightSummary(summary) {
    // Expose only dashboard fields here so API responses do not leak DB-specific metadata.
    const safeSummary = summary || {
        totalReviews: 0,
        averageRating: 0,
        positivePercentage: 0,
        neutralPercentage: 0,
        negativePercentage: 0,
    }

    return {
        totalReviews: safeSummary.totalReviews,
        averageRating: safeSummary.averageRating,
        positivePercentage: safeSummary.positivePercentage,
        neutralPercentage: safeSummary.neutralPercentage,
        negativePercentage: safeSummary.negativePercentage,
    }
}

async function buildComplaintKeywordRows(restaurantId, reviews) {
    const keywordCounts = new Map()
    const negativeReviews = reviews.filter((review) => review.sentiment === 'NEGATIVE')

    for (const review of negativeReviews) {
        const keywords =
            Array.isArray(review.keywords) && review.keywords.length > 0
                ? review.keywords
                : extractComplaintKeywords(review.content)

        // Count each keyword once per review to avoid long repeated text inflating complaint stats.
        const uniqueKeywords = [...new Set(keywords)]

        for (const keyword of uniqueKeywords) {
            keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1)
        }
    }

    return [...keywordCounts.entries()]
        .sort((left, right) => {
            if (right[1] !== left[1]) {
                return right[1] - left[1]
            }

            return left[0].localeCompare(right[0])
        })
        .slice(0, 10)
        .map(([keyword, count]) => ({
            restaurantId,
            keyword,
            count,
            percentage: toPercentage(count, negativeReviews.length),
            lastUpdatedAt: new Date(),
        }))
}

async function recalculateRestaurantInsights({ restaurantId }) {
    const [reviewAggregate, sentimentGroups, negativeReviews] = await Promise.all([
        prisma.review.aggregate({
            where: {
                restaurantId,
            },
            _count: {
                _all: true,
            },
            _avg: {
                rating: true,
            },
        }),
        prisma.review.groupBy({
            by: ['sentiment'],
            where: {
                restaurantId,
                sentiment: {
                    not: null,
                },
            },
            _count: {
                _all: true,
            },
        }),
        prisma.review.findMany({
            where: {
                restaurantId,
                sentiment: 'NEGATIVE',
            },
            select: {
                sentiment: true,
                content: true,
                keywords: true,
            },
        }),
    ])

    const totalReviews = reviewAggregate._count._all
    const sentimentCounts = {
        POSITIVE: 0,
        NEUTRAL: 0,
        NEGATIVE: 0,
    }

    for (const group of sentimentGroups) {
        if (group.sentiment && sentimentCounts[group.sentiment] !== undefined) {
            sentimentCounts[group.sentiment] = group._count._all
        }
    }

    const insightPayload = {
        averageRating: totalReviews ? roundNumber(reviewAggregate._avg.rating, 1) : 0,
        totalReviews,
        positivePercentage: toPercentage(sentimentCounts.POSITIVE, totalReviews),
        neutralPercentage: toPercentage(sentimentCounts.NEUTRAL, totalReviews),
        negativePercentage: toPercentage(sentimentCounts.NEGATIVE, totalReviews),
        lastCalculatedAt: new Date(),
    }

    const complaintKeywordRows = await buildComplaintKeywordRows(restaurantId, negativeReviews)

    await prisma.$transaction(async (tx) => {
        // Keep summary cache and complaint keywords in sync; dashboard should never read half-updated aggregates.
        await tx.insightSummary.upsert({
            where: {
                restaurantId,
            },
            update: insightPayload,
            create: {
                restaurantId,
                ...insightPayload,
            },
        })

        await tx.complaintKeyword.deleteMany({
            where: {
                restaurantId,
            },
        })

        if (complaintKeywordRows.length > 0) {
            await tx.complaintKeyword.createMany({
                data: complaintKeywordRows,
            })
        }
    })

    return {
        ...insightPayload,
        complaintKeywords: complaintKeywordRows,
    }
}

module.exports = {
    buildInsightSummary,
    recalculateRestaurantInsights,
}
