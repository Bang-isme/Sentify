const prisma = require('../lib/prisma')
const { analyzeReview } = require('./sentiment-analyzer.service')

function roundNumber(value, digits = 1) {
    return Number(Number(value || 0).toFixed(digits))
}

function toPercentage(count, total) {
    if (!total) {
        return 0
    }

    return roundNumber((count / total) * 100, 1)
}

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
    const negativeReviews = reviews.filter((review) => review.sentiment === 'NEGATIVE')
    const keywordCounts = new Map()
    const analyzedReviews = await Promise.all(
        negativeReviews.map(async (review) => ({
            keywords: review.content
                ? (
                      await analyzeReview({
                          content: review.content,
                          rating: review.rating,
                      })
                  ).keywords
                : [],
        })),
    )

    for (const { keywords } of analyzedReviews) {
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
    const reviews = await prisma.review.findMany({
        where: {
            restaurantId,
        },
        select: {
            rating: true,
            sentiment: true,
            content: true,
        },
    })

    const totalReviews = reviews.length
    const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0)
    const sentimentCounts = {
        POSITIVE: 0,
        NEUTRAL: 0,
        NEGATIVE: 0,
    }

    for (const review of reviews) {
        if (review.sentiment && sentimentCounts[review.sentiment] !== undefined) {
            sentimentCounts[review.sentiment] += 1
        }
    }

    const insightPayload = {
        averageRating: totalReviews ? roundNumber(ratingSum / totalReviews, 1) : 0,
        totalReviews,
        positivePercentage: toPercentage(sentimentCounts.POSITIVE, totalReviews),
        neutralPercentage: toPercentage(sentimentCounts.NEUTRAL, totalReviews),
        negativePercentage: toPercentage(sentimentCounts.NEGATIVE, totalReviews),
        lastCalculatedAt: new Date(),
    }

    const complaintKeywordRows = await buildComplaintKeywordRows(restaurantId, reviews)

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
    toPercentage,
}
