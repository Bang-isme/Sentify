const prisma = require('../lib/prisma')
const { roundNumber, toPercentage } = require('../lib/math')
const { buildInsightSummary } = require('./insight.service')
const { getRestaurantAccess } = require('./restaurant-access.service')

function buildIsoWeekLabel(date) {
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const day = utcDate.getUTCDay() || 7
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
    const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)
    return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function buildMonthLabel(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function buildBucket(period, date) {
    const safeDate = new Date(date)

    if (period === 'month') {
        return {
            label: buildMonthLabel(safeDate),
            sortKey: Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), 1),
        }
    }

    const day = safeDate.getUTCDay() || 7
    safeDate.setUTCDate(safeDate.getUTCDate() + 1 - day)
    safeDate.setUTCHours(0, 0, 0, 0)

    return {
        label: buildIsoWeekLabel(date),
        sortKey: safeDate.getTime(),
    }
}

async function ensureRestaurantAccess(userId, restaurantId) {
    await getRestaurantAccess({
        userId,
        restaurantId,
    })
}

async function getRestaurantKpi({ userId, restaurantId }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        restaurantInclude: {
            insight: true,
        },
    })

    // KPI reads the cached summary so the dashboard stays cheap after each intake publish recalculation.
    return buildInsightSummary(access.restaurantWithRelations.insight)
}

async function getSentimentBreakdown({ userId, restaurantId }) {
    await ensureRestaurantAccess(userId, restaurantId)

    const reviews = await prisma.review.findMany({
        where: {
            restaurantId,
        },
        select: {
            sentiment: true,
        },
    })

    const total = reviews.length
    const counts = {
        POSITIVE: 0,
        NEUTRAL: 0,
        NEGATIVE: 0,
    }

    for (const review of reviews) {
        if (review.sentiment && counts[review.sentiment] !== undefined) {
            counts[review.sentiment] += 1
        }
    }

    return ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].map((label) => ({
        label,
        count: counts[label],
        percentage: toPercentage(counts[label], total),
    }))
}

async function getTrend({ userId, restaurantId, period = 'week' }) {
    await ensureRestaurantAccess(userId, restaurantId)

    const reviews = await prisma.review.findMany({
        where: {
            restaurantId,
        },
        select: {
            rating: true,
            reviewDate: true,
            createdAt: true,
        },
    })

    const grouped = new Map()

    for (const review of reviews) {
        // Some reviews may miss source dates, so trend falls back to createdAt.
        const sourceDate = review.reviewDate || review.createdAt
        const bucket = buildBucket(period, sourceDate)
        const current = grouped.get(bucket.label) || {
            label: bucket.label,
            sortKey: bucket.sortKey,
            ratingSum: 0,
            reviewCount: 0,
        }

        current.ratingSum += review.rating
        current.reviewCount += 1
        grouped.set(bucket.label, current)
    }

    return [...grouped.values()]
        .sort((left, right) => left.sortKey - right.sortKey)
        .map((bucket) => ({
            label: bucket.label,
            averageRating: roundNumber(bucket.ratingSum / bucket.reviewCount, 1),
            reviewCount: bucket.reviewCount,
        }))
}

async function getComplaintKeywords({ userId, restaurantId }) {
    await ensureRestaurantAccess(userId, restaurantId)

    const keywords = await prisma.complaintKeyword.findMany({
        where: {
            restaurantId,
        },
        orderBy: [{ count: 'desc' }, { keyword: 'asc' }],
        select: {
            keyword: true,
            count: true,
            percentage: true,
        },
    })

    return keywords
}

function buildTopIssueAction(keyword, count) {
    if (!keyword) {
        return null
    }

    const countLabel = typeof count === 'number' ? count : 0
    const plural = countLabel === 1 ? '' : 's'
    return `Prioritize improving ${keyword} — review ${countLabel} related complaint${plural}.`
}

async function getTopIssue({ userId, restaurantId }) {
    await ensureRestaurantAccess(userId, restaurantId)

    const topKeyword = await prisma.complaintKeyword.findFirst({
        where: {
            restaurantId,
        },
        orderBy: [{ count: 'desc' }, { keyword: 'asc' }],
        select: {
            keyword: true,
            count: true,
            percentage: true,
            lastUpdatedAt: true,
        },
    })

    if (!topKeyword) {
        return {
            keyword: null,
            count: 0,
            percentage: 0,
            action: null,
            lastUpdatedAt: null,
        }
    }

    return {
        keyword: topKeyword.keyword,
        count: topKeyword.count,
        percentage: topKeyword.percentage,
        action: buildTopIssueAction(topKeyword.keyword, topKeyword.count),
        lastUpdatedAt: topKeyword.lastUpdatedAt,
    }
}

module.exports = {
    getRestaurantKpi,
    getSentimentBreakdown,
    getTrend,
    getComplaintKeywords,
    getTopIssue,
}
