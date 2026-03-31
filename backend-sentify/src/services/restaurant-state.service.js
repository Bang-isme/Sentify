const { badRequest } = require('../lib/app-error')
const googleMapsProvider = require('../modules/review-crawl/google-maps.service')
const prisma = require('../lib/prisma')

const PERSISTED_SOURCE_SUBMISSION_STATUS = Object.freeze({
    PENDING_IDENTITY_RESOLUTION: 'PENDING_IDENTITY_RESOLUTION',
    READY_FOR_SOURCE_LINK: 'READY_FOR_SOURCE_LINK',
    LINKED_TO_SOURCE: 'LINKED_TO_SOURCE',
})

const SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION = Object.freeze({
    ALREADY_CONNECTED: 'ALREADY_CONNECTED',
    REUSE_SHARED_IDENTITY: 'REUSE_SHARED_IDENTITY',
    SUBMIT_FOR_ADMIN_SYNC: 'SUBMIT_FOR_ADMIN_SYNC',
})

const SOURCE_SUBMISSION_SCHEDULING_LANE = Object.freeze({
    STANDARD: 'STANDARD',
    PRIORITY: 'PRIORITY',
})

function derivePersistedSourceSubmissionStatus({ analysis = null, linkedSourceId = null } = {}) {
    if (linkedSourceId || analysis?.sameRestaurantSource) {
        return PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE
    }

    if (analysis?.resolved?.place?.identifiers?.cid) {
        return PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK
    }

    return PERSISTED_SOURCE_SUBMISSION_STATUS.PENDING_IDENTITY_RESOLUTION
}

function deriveSourceSubmissionDedupeKey({
    canonicalCid = null,
    normalizedUrl = null,
    inputUrl,
}) {
    if (canonicalCid) {
        return `cid:${canonicalCid}`
    }

    return `url:${normalizedUrl ?? inputUrl}`
}

function buildSourceSubmissionAuditSnapshot(submission) {
    if (!submission) {
        return null
    }

    return {
        submissionId: submission.id ?? null,
        provider: submission.provider ?? 'GOOGLE_MAPS',
        inputUrl: submission.inputUrl ?? null,
        normalizedUrl: submission.normalizedUrl ?? null,
        canonicalCid: submission.canonicalCid ?? null,
        placeHexId: submission.placeHexId ?? null,
        googlePlaceId: submission.googlePlaceId ?? null,
        placeName: submission.placeName ?? null,
        dedupeKey: submission.dedupeKey ?? null,
        persistedStatus: submission.status ?? submission.persistedStatus ?? null,
        schedulingLane: submission.schedulingLane ?? null,
        schedulingLaneSource: submission.schedulingLaneSource ?? null,
        linkedSourceId: submission.linkedSourceId ?? null,
        recommendationCode: submission.recommendationCode ?? null,
        recommendationMessage: submission.recommendationMessage ?? null,
        submittedAt: submission.submittedAt ?? null,
        lastResolvedAt: submission.lastResolvedAt ?? null,
    }
}

function deriveOpenBatchSummaryFromItems(openBatches = []) {
    return openBatches.reduce(
        (summary, batch) => {
            summary.pendingBatchCount += 1

            if (batch.status === 'READY_TO_PUBLISH') {
                summary.readyBatchCount += 1
            }

            for (const item of batch.items || []) {
                if (item.approvalStatus === 'APPROVED') {
                    summary.approvedItemCount += 1
                } else if (item.approvalStatus === 'REJECTED') {
                    summary.rejectedItemCount += 1
                } else {
                    summary.pendingItemCount += 1
                }
            }

            return summary
        },
        {
            pendingBatchCount: 0,
            readyBatchCount: 0,
            pendingItemCount: 0,
            approvedItemCount: 0,
            rejectedItemCount: 0,
        },
    )
}

function buildDatasetStatus({
    latestPublishedBatch,
    openBatches = [],
    openBatchSummary = null,
}) {
    const sourcePolicy = latestPublishedBatch ? 'ADMIN_CURATED' : 'UNCONFIGURED'
    const summary = openBatchSummary ?? deriveOpenBatchSummaryFromItems(openBatches)

    return {
        sourcePolicy,
        lastPublishedAt: latestPublishedBatch?.publishedAt ?? null,
        lastPublishedSourceType: latestPublishedBatch?.sourceType ?? null,
        pendingBatchCount: summary.pendingBatchCount,
        readyBatchCount: summary.readyBatchCount,
        pendingItemCount: summary.pendingItemCount,
        approvedItemCount: summary.approvedItemCount,
        rejectedItemCount: summary.rejectedItemCount,
    }
}

async function analyzeGoogleMapsSourceSubmission({
    restaurantId,
    googleMapUrl,
    savedGoogleMapUrl = null,
    language = 'en',
    region = 'us',
}) {
    const resolved = await googleMapsProvider.resolveGoogleMapsSource({
        url: googleMapUrl,
        language,
        region,
    })
    const canonicalCid = resolved.place?.identifiers?.cid ?? null

    if (!canonicalCid) {
        throw badRequest(
            'RESTAURANT_SOURCE_IDENTITY_UNAVAILABLE',
            'Could not resolve a canonical Google Maps place identity from the submitted URL',
        )
    }

    const [sameRestaurantSource, otherRestaurantMatches] = await Promise.all([
        prisma.reviewCrawlSource.findUnique({
            where: {
                restaurantId_provider_canonicalCid: {
                    restaurantId,
                    provider: 'GOOGLE_MAPS',
                    canonicalCid,
                },
            },
            select: {
                id: true,
                inputUrl: true,
                status: true,
                syncEnabled: true,
                placeName: true,
                lastSuccessfulRunAt: true,
            },
        }),
        prisma.reviewCrawlSource.findMany({
            where: {
                provider: 'GOOGLE_MAPS',
                canonicalCid,
                restaurantId: {
                    not: restaurantId,
                },
            },
            select: {
                restaurantId: true,
            },
            distinct: ['restaurantId'],
        }),
    ])

    const otherRestaurantCount = otherRestaurantMatches.length
    const exactSavedUrlMatches =
        typeof savedGoogleMapUrl === 'string' && savedGoogleMapUrl.trim() === googleMapUrl.trim()
    const sameRestaurantSourceExists = Boolean(sameRestaurantSource)

    let recommendationCode = SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION.SUBMIT_FOR_ADMIN_SYNC
    let recommendationMessage =
        'This looks like a valid Google Maps place. Save it and let admin sync it into the review pipeline.'

    if (sameRestaurantSourceExists) {
        recommendationCode = SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION.ALREADY_CONNECTED
        recommendationMessage = exactSavedUrlMatches
            ? 'This Google Maps place is already connected to your restaurant.'
            : 'This URL resolves to the same Google Maps place your restaurant already uses.'
    } else if (otherRestaurantCount > 0) {
        recommendationCode = SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION.REUSE_SHARED_IDENTITY
        recommendationMessage =
            'This Google Maps place is already known to the system and can reuse a shared place identity after admin review.'
    }

    return {
        resolved,
        sameRestaurantSource,
        sameRestaurantSourceExists,
        otherRestaurantCount,
        exactSavedUrlMatches,
        recommendationCode,
        recommendationMessage,
    }
}

async function fetchIntakeSummary(restaurantId) {
    const openStatuses = ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH']

    const [latestPublishedBatch, openBatches, approvalCounts] = await Promise.all([
        prisma.reviewIntakeBatch.findFirst({
            where: {
                restaurantId,
                status: 'PUBLISHED',
            },
            orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
            select: {
                sourceType: true,
                publishedAt: true,
            },
        }),
        prisma.reviewIntakeBatch.findMany({
            where: {
                restaurantId,
                status: {
                    in: openStatuses,
                },
            },
            select: {
                status: true,
            },
        }),
        prisma.reviewIntakeItem.groupBy({
            by: ['approvalStatus'],
            where: {
                restaurantId,
                batch: {
                    status: {
                        in: openStatuses,
                    },
                },
            },
            _count: { _all: true },
        }),
    ])

    const openBatchSummary = deriveOpenBatchSummaryFromItems(openBatches)
    for (const group of approvalCounts) {
        if (group.approvalStatus === 'APPROVED') {
            openBatchSummary.approvedItemCount += group._count._all
        } else if (group.approvalStatus === 'REJECTED') {
            openBatchSummary.rejectedItemCount += group._count._all
        } else {
            openBatchSummary.pendingItemCount += group._count._all
        }
    }

    return {
        latestPublishedBatch,
        openBatches,
        openBatchSummary,
    }
}

module.exports = {
    PERSISTED_SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION,
    SOURCE_SUBMISSION_SCHEDULING_LANE,
    analyzeGoogleMapsSourceSubmission,
    buildDatasetStatus,
    buildSourceSubmissionAuditSnapshot,
    derivePersistedSourceSubmissionStatus,
    deriveSourceSubmissionDedupeKey,
    fetchIntakeSummary,
}
