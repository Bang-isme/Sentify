const prisma = require('../lib/prisma')
const { roundNumber, toPercentage } = require('../lib/math')
const { buildInsightSummary } = require('./insight.service')
const {
    getEffectiveRestaurantEntitlement,
} = require('./restaurant-entitlement.service')
const { getRestaurantAccess } = require('./restaurant-access.service')
const { normalizeText } = require('./sentiment-analyzer.service')

const MERCHANT_ACTION_SUMMARY_STATE = {
    AWAITING_SOURCE: 'AWAITING_SOURCE',
    AWAITING_FIRST_PUBLISH: 'AWAITING_FIRST_PUBLISH',
    ACTIONABLE_NOW: 'ACTIONABLE_NOW',
    MONITORING: 'MONITORING',
}

const MERCHANT_ACTION_PRIORITY = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
}

const MERCHANT_ACTION_TIMING = {
    TODAY: 'TODAY',
    THIS_WEEK: 'THIS_WEEK',
    MONITOR: 'MONITOR',
}

const MERCHANT_ACTION_STATUS = {
    NOW: 'NOW',
    NEXT: 'NEXT',
}

const MERCHANT_ACTION_RECOMMENDATION_CODE = {
    FIX_RESPONSE_TIME: 'FIX_RESPONSE_TIME',
    FIX_SERVICE_ATTITUDE: 'FIX_SERVICE_ATTITUDE',
    FIX_CLEANLINESS: 'FIX_CLEANLINESS',
    FIX_VALUE_PERCEPTION: 'FIX_VALUE_PERCEPTION',
    FIX_COMFORT_AND_NOISE: 'FIX_COMFORT_AND_NOISE',
    REVIEW_OPERATIONS: 'REVIEW_OPERATIONS',
}

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

function truncateText(text, limit = 180) {
    const value = String(text || '').trim()

    if (!value) {
        return null
    }

    if (value.length <= limit) {
        return value
    }

    return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`
}

function normalizeDashboardKeyword(keyword) {
    return normalizeText(keyword || '')
}

function resolveMerchantActionRecommendationCode(keyword) {
    const normalizedKeyword = normalizeDashboardKeyword(keyword)

    if (!normalizedKeyword) {
        return MERCHANT_ACTION_RECOMMENDATION_CODE.REVIEW_OPERATIONS
    }

    if (
        normalizedKeyword.includes('slow') ||
        normalizedKeyword.includes('late') ||
        normalizedKeyword.includes('cham') ||
        normalizedKeyword.includes('lau')
    ) {
        return MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_RESPONSE_TIME
    }

    if (
        normalizedKeyword.includes('rude') ||
        normalizedKeyword.includes('thai do') ||
        normalizedKeyword.includes('khong than thien') ||
        normalizedKeyword.includes('staff')
    ) {
        return MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_SERVICE_ATTITUDE
    }

    if (
        normalizedKeyword.includes('dirty') ||
        normalizedKeyword.includes('ban') ||
        normalizedKeyword.includes('clean') ||
        normalizedKeyword.includes('ve sinh')
    ) {
        return MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_CLEANLINESS
    }

    if (
        normalizedKeyword.includes('overpriced') ||
        normalizedKeyword.includes('gia cao') ||
        normalizedKeyword.includes('portion')
    ) {
        return MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_VALUE_PERCEPTION
    }

    if (
        normalizedKeyword.includes('noisy') ||
        normalizedKeyword.includes('on ao') ||
        normalizedKeyword.includes('comfort')
    ) {
        return MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_COMFORT_AND_NOISE
    }

    return MERCHANT_ACTION_RECOMMENDATION_CODE.REVIEW_OPERATIONS
}

function deriveMerchantActionPriority({ affectedReviewCount, affectedReviewPercentage }) {
    if (affectedReviewPercentage >= 40 || affectedReviewCount >= 3) {
        return MERCHANT_ACTION_PRIORITY.HIGH
    }

    if (affectedReviewPercentage >= 20 || affectedReviewCount >= 2) {
        return MERCHANT_ACTION_PRIORITY.MEDIUM
    }

    return MERCHANT_ACTION_PRIORITY.LOW
}

function deriveMerchantActionTiming(priority) {
    if (priority === MERCHANT_ACTION_PRIORITY.HIGH) {
        return MERCHANT_ACTION_TIMING.TODAY
    }

    if (priority === MERCHANT_ACTION_PRIORITY.MEDIUM) {
        return MERCHANT_ACTION_TIMING.THIS_WEEK
    }

    return MERCHANT_ACTION_TIMING.MONITOR
}

function buildMerchantActionTitle(keyword) {
    return `Reduce complaints about ${keyword}`
}

function buildMerchantActionSummary({ keyword, count, percentage }) {
    const complaintLabel = count === 1 ? 'complaint' : 'complaints'
    return `${count} published negative ${complaintLabel} mention ${keyword}, representing ${percentage}% of the live negative feedback.`
}

function buildMerchantActionEvidenceSummary({ keyword, evidenceReview }) {
    if (evidenceReview?.content) {
        return `Recent evidence mentioning ${keyword}: "${truncateText(evidenceReview.content, 140)}"`
    }

    return `Published complaints repeatedly mention ${keyword}.`
}

function buildMerchantActionNextStep(recommendationCode) {
    switch (recommendationCode) {
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_RESPONSE_TIME:
            return 'Check staffing and order handoff during peak hours, then verify wait-time complaints drop in the next publish.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_SERVICE_ATTITUDE:
            return 'Review service interactions from the affected shift and coach the team on greeting, attentiveness, and recovery.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_CLEANLINESS:
            return 'Tighten table, restroom, and floor checks during busy windows and confirm the next reviews stop mentioning cleanliness.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_VALUE_PERCEPTION:
            return 'Review portion, pricing, or offer framing so guests understand the value before the next publishing cycle.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_COMFORT_AND_NOISE:
            return 'Inspect seating, queue flow, and dining-room comfort to reduce the environmental friction guests are describing.'
        default:
            return 'Read the linked review evidence, identify the repeated operational cause, and validate the fix in the next published wave.'
    }
}

function buildMerchantCurrentFocus(recommendationCode) {
    switch (recommendationCode) {
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_RESPONSE_TIME:
            return 'Use published complaints to tighten speed of service first.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_SERVICE_ATTITUDE:
            return 'Use published complaints to improve staff hospitality first.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_CLEANLINESS:
            return 'Use published complaints to improve cleanliness first.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_VALUE_PERCEPTION:
            return 'Use published complaints to improve perceived value first.'
        case MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_COMFORT_AND_NOISE:
            return 'Use published complaints to improve dining-room comfort first.'
        default:
            return 'Use published complaints to decide the first operational fix.'
    }
}

function buildMerchantNextCapability(state) {
    switch (state) {
        case MERCHANT_ACTION_SUMMARY_STATE.AWAITING_SOURCE:
            return {
                nextCapabilityCode: 'CONNECT_SOURCE',
                nextCapability: 'Connect the correct Google Maps place so the review pipeline can start.',
            }
        case MERCHANT_ACTION_SUMMARY_STATE.AWAITING_FIRST_PUBLISH:
            return {
                nextCapabilityCode: 'WAIT_FOR_FIRST_PUBLISH',
                nextCapability: 'Wait for the first crawl, review, and publish cycle before prioritizing action.',
            }
        case MERCHANT_ACTION_SUMMARY_STATE.ACTIONABLE_NOW:
            return {
                nextCapabilityCode: 'ASSIGN_AND_TRACK',
                nextCapability: 'Turn the top issue into ownership, follow-up, and repeat measurement in later publishes.',
            }
        default:
            return {
                nextCapabilityCode: 'MONITOR_AND_REFRESH',
                nextCapability: 'Keep monitoring the published dataset until a stronger issue pattern emerges.',
            }
    }
}

function reviewMatchesKeyword(review, keyword) {
    const normalizedKeyword = normalizeDashboardKeyword(keyword)

    if (!normalizedKeyword || !review) {
        return false
    }

    const normalizedContent = normalizeText(review.content || '')

    if (normalizedContent.includes(normalizedKeyword)) {
        return true
    }

    const reviewKeywords = Array.isArray(review.keywords) ? review.keywords : []
    return reviewKeywords.some((candidate) => normalizeDashboardKeyword(candidate) === normalizedKeyword)
}

function buildMerchantEvidenceReview(review) {
    if (!review) {
        return null
    }

    return {
        id: review.id,
        authorName: review.authorName,
        rating: review.rating,
        sentiment: review.sentiment,
        content: truncateText(review.content, 240),
        reviewDate: review.reviewDate || review.createdAt || null,
    }
}

function selectEvidenceReviewForKeyword(reviews, keyword) {
    return reviews.find((review) => reviewMatchesKeyword(review, keyword)) || reviews[0] || null
}

function buildMerchantActionCard({ complaintKeyword, evidenceReview, negativeReviewTotal, index }) {
    const recommendationCode = resolveMerchantActionRecommendationCode(complaintKeyword.keyword)
    const priority = deriveMerchantActionPriority({
        affectedReviewCount: complaintKeyword.count,
        affectedReviewPercentage: complaintKeyword.percentage,
    })

    return {
        keyword: complaintKeyword.keyword,
        title: buildMerchantActionTitle(complaintKeyword.keyword),
        summary: buildMerchantActionSummary({
            keyword: complaintKeyword.keyword,
            count: complaintKeyword.count,
            percentage: complaintKeyword.percentage,
        }),
        evidenceSummary: buildMerchantActionEvidenceSummary({
            keyword: complaintKeyword.keyword,
            evidenceReview,
        }),
        nextStep: buildMerchantActionNextStep(recommendationCode),
        recommendationCode,
        affectedReviewCount: complaintKeyword.count,
        affectedReviewPercentage: complaintKeyword.percentage,
        negativeReviewTotal,
        priority,
        timing: deriveMerchantActionTiming(priority),
        status: index === 0 ? MERCHANT_ACTION_STATUS.NOW : MERCHANT_ACTION_STATUS.NEXT,
        evidenceReview: buildMerchantEvidenceReview(evidenceReview),
        lastUpdatedAt: complaintKeyword.lastUpdatedAt || evidenceReview?.reviewDate || evidenceReview?.createdAt || null,
    }
}

function buildMerchantTopIssue(complaintKeyword, evidenceReview, negativeReviewTotal) {
    if (!complaintKeyword) {
        return null
    }

    const recommendationCode = resolveMerchantActionRecommendationCode(complaintKeyword.keyword)
    const priority = deriveMerchantActionPriority({
        affectedReviewCount: complaintKeyword.count,
        affectedReviewPercentage: complaintKeyword.percentage,
    })

    return {
        keyword: complaintKeyword.keyword,
        affectedReviewCount: complaintKeyword.count,
        affectedReviewPercentage: complaintKeyword.percentage,
        negativeReviewTotal,
        priority,
        recommendationCode,
        recommendation: buildMerchantActionNextStep(recommendationCode),
        action: buildTopIssueAction(complaintKeyword.keyword, complaintKeyword.count),
        evidenceSummary: buildMerchantActionEvidenceSummary({
            keyword: complaintKeyword.keyword,
            evidenceReview,
        }),
        evidenceReview: buildMerchantEvidenceReview(evidenceReview),
        lastUpdatedAt: complaintKeyword.lastUpdatedAt || evidenceReview?.reviewDate || evidenceReview?.createdAt || null,
    }
}

function buildMerchantActionsSummary({ hasSourceUrl, insightSummary, topIssue }) {
    if (!hasSourceUrl) {
        return {
            state: MERCHANT_ACTION_SUMMARY_STATE.AWAITING_SOURCE,
            focusCode: 'CONNECT_SOURCE',
            headline: 'Connect a Google Maps place first.',
            detail: 'This restaurant does not have an active Google Maps URL yet, so there is no live review pipeline to prioritize.',
            generatedAt: new Date(),
        }
    }

    if ((insightSummary?.totalReviews || 0) === 0) {
        return {
            state: MERCHANT_ACTION_SUMMARY_STATE.AWAITING_FIRST_PUBLISH,
            focusCode: 'WAIT_FOR_FIRST_PUBLISH',
            headline: 'Wait for the first published dataset.',
            detail: 'A source is configured, but there are no published reviews yet. Merchant actions should start after the first review and publish cycle.',
            generatedAt: new Date(),
        }
    }

    if (topIssue) {
        return {
            state: MERCHANT_ACTION_SUMMARY_STATE.ACTIONABLE_NOW,
            focusCode: topIssue.recommendationCode,
            headline: `Focus on ${topIssue.keyword} first.`,
            detail: `${topIssue.affectedReviewCount} published negative reviews mention ${topIssue.keyword}, which is ${topIssue.affectedReviewPercentage}% of the live negative feedback right now.`,
            generatedAt: new Date(),
        }
    }

    return {
        state: MERCHANT_ACTION_SUMMARY_STATE.MONITORING,
        focusCode: 'MONITORING',
        headline: 'Keep monitoring live guest feedback.',
        detail: 'The current published dataset does not show one dominant negative issue yet, so use the dashboard to watch for the next repeated complaint.',
        generatedAt: new Date(),
    }
}

function buildMerchantExecutionLayer({ summary, topIssue }) {
    const nextCapability = buildMerchantNextCapability(summary.state)

    return {
        currentFocusCode: summary.focusCode,
        currentFocus:
            summary.state === MERCHANT_ACTION_SUMMARY_STATE.ACTIONABLE_NOW && topIssue
                ? buildMerchantCurrentFocus(topIssue.recommendationCode)
                : summary.headline,
        nextCapabilityCode: nextCapability.nextCapabilityCode,
        nextCapability: nextCapability.nextCapability,
    }
}

function buildMerchantActionsPayload({
    restaurant,
    insightSummary,
    complaintKeywords,
    negativeReviews,
    entitlement,
}) {
    const hasSourceUrl = Boolean(restaurant?.googleMapUrl)
    const negativeReviewTotal = negativeReviews.length
    const actionCardsLimit =
        entitlement?.effectivePolicy?.actionCardsLimit ?? 1
    const prioritizedKeywords = complaintKeywords.slice(0, actionCardsLimit)
    const topKeyword = prioritizedKeywords[0] || null
    const topEvidenceReview = topKeyword
        ? selectEvidenceReviewForKeyword(negativeReviews, topKeyword.keyword)
        : null
    const topIssue = buildMerchantTopIssue(topKeyword, topEvidenceReview, negativeReviewTotal)
    const summary = buildMerchantActionsSummary({
        hasSourceUrl,
        insightSummary,
        topIssue,
    })

    const actionCards =
        summary.state === MERCHANT_ACTION_SUMMARY_STATE.ACTIONABLE_NOW
            ? prioritizedKeywords.map((complaintKeyword, index) =>
                buildMerchantActionCard({
                    complaintKeyword,
                    evidenceReview: selectEvidenceReviewForKeyword(negativeReviews, complaintKeyword.keyword),
                    negativeReviewTotal,
                    index,
                }),
            )
            : []

    return {
        entitlement,
        capabilities: {
            sourceSubmissionLane:
                entitlement?.effectivePolicy?.sourceSubmissionLane ?? 'STANDARD',
            sourceSyncIntervalMinutes:
                entitlement?.effectivePolicy?.sourceSyncIntervalMinutes ?? 1440,
            actionCardsLimit,
            prioritySync:
                entitlement?.effectivePolicy?.prioritySync ?? false,
            processingClass:
                entitlement?.effectivePolicy?.processingClass ??
                'STANDARD_QUEUE',
        },
        summary,
        snapshot: {
            hasSourceUrl,
            totalReviews: insightSummary.totalReviews,
            averageRating: insightSummary.averageRating,
            negativePercentage: insightSummary.negativePercentage,
        },
        executionLayer: buildMerchantExecutionLayer({ summary, topIssue }),
        topIssue,
        actionCards,
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

    // Run groupBy + total count in parallel.
    // Total includes null-sentiment reviews so percentages stay consistent with KPI.
    const [groups, totalResult] = await Promise.all([
        prisma.review.groupBy({
            by: ['sentiment'],
            where: {
                restaurantId,
                sentiment: { not: null },
            },
            _count: { _all: true },
        }),
        prisma.review.count({
            where: { restaurantId },
        }),
    ])

    const total = totalResult
    const counts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 }

    for (const group of groups) {
        if (group.sentiment && counts[group.sentiment] !== undefined) {
            counts[group.sentiment] = group._count._all
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

    const truncUnit = period === 'month' ? 'month' : 'week'

    const rows = await prisma.$queryRaw`
        SELECT
            date_trunc(${truncUnit}, COALESCE("reviewDate", "createdAt") AT TIME ZONE 'UTC') AS bucket,
            AVG(rating)::float AS "averageRating",
            COUNT(*)::int AS "reviewCount"
        FROM "Review"
        WHERE "restaurantId" = ${restaurantId}
        GROUP BY bucket
        ORDER BY bucket ASC
    `

    return rows.map((row) => {
        const date = new Date(row.bucket)
        const label = period === 'month' ? buildMonthLabel(date) : buildIsoWeekLabel(date)

        return {
            label,
            averageRating: roundNumber(row.averageRating, 1),
            reviewCount: row.reviewCount,
        }
    })
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
            lastUpdatedAt: true,
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
    return `Prioritize improving ${keyword} - review ${countLabel} related complaint${plural}.`
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

async function getMerchantActions({ userId, restaurantId }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        restaurantInclude: {
            insight: true,
        },
    })

    const restaurant = access.restaurantWithRelations
    const insightSummary = buildInsightSummary(restaurant.insight)

    const [complaintKeywords, negativeReviews, entitlement] = await Promise.all([
        prisma.complaintKeyword.findMany({
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
        }),
        prisma.review.findMany({
            where: {
                restaurantId,
                sentiment: 'NEGATIVE',
            },
            orderBy: [{ reviewDate: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                authorName: true,
                rating: true,
                sentiment: true,
                content: true,
                reviewDate: true,
                createdAt: true,
                keywords: true,
            },
        }),
        getEffectiveRestaurantEntitlement(restaurantId),
    ])

    return buildMerchantActionsPayload({
        restaurant,
        insightSummary,
        complaintKeywords,
        negativeReviews,
        entitlement,
    })
}

module.exports = {
    getRestaurantKpi,
    getSentimentBreakdown,
    getTrend,
    getComplaintKeywords,
    getTopIssue,
    getMerchantActions,
    __private: {
        MERCHANT_ACTION_SUMMARY_STATE,
        MERCHANT_ACTION_PRIORITY,
        MERCHANT_ACTION_TIMING,
        MERCHANT_ACTION_STATUS,
        MERCHANT_ACTION_RECOMMENDATION_CODE,
        buildMerchantActionsPayload,
        buildMerchantActionsSummary,
        buildMerchantActionCard,
        buildMerchantTopIssue,
        deriveMerchantActionPriority,
        resolveMerchantActionRecommendationCode,
        reviewMatchesKeyword,
    },
}
