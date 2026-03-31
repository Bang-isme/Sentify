const prisma = require('../lib/prisma')
const { appendAuditEvent } = require('./audit-event.service')
const {
    ensureRestaurantEntitlement,
    getEffectiveRestaurantEntitlement,
    RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE,
} = require('./restaurant-entitlement.service')
const {
    PERSISTED_SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION,
    analyzeGoogleMapsSourceSubmission,
    derivePersistedSourceSubmissionStatus,
    deriveSourceSubmissionDedupeKey,
} = require('./restaurant-state.service')

async function syncSourceSubmissionRecord({
    restaurantId,
    userId,
    googleMapUrl,
    savedGoogleMapUrl = null,
    language = 'en',
    region = 'us',
    tx = prisma,
    analysis: providedAnalysis,
}) {
    if (!googleMapUrl) {
        await tx.restaurantSourceSubmission.deleteMany({
            where: {
                restaurantId,
            },
        })

        return null
    }

    const existingSubmission = await tx.restaurantSourceSubmission.findUnique({
        where: {
            restaurantId,
        },
        select: {
            inputUrl: true,
            submittedAt: true,
            schedulingLane: true,
            schedulingLaneSource: true,
            claimedByUserId: true,
            claimedAt: true,
            claimExpiresAt: true,
        },
    })

    const effectiveEntitlement = await getEffectiveRestaurantEntitlement({
        restaurantId,
        tx,
    })
    let analysis = providedAnalysis

    if (!Object.prototype.hasOwnProperty.call(arguments[0], 'analysis')) {
        try {
            analysis = await analyzeGoogleMapsSourceSubmission({
                restaurantId,
                googleMapUrl,
                savedGoogleMapUrl,
                language,
                region,
            })
        } catch {
            // Saving the merchant's source submission should not be blocked by a transient
            // upstream Google Maps resolution failure. Admin can still resolve the place later.
            analysis = null
        }
    }

    const timestamp = new Date()
    const sameInputUrlAsExisting = existingSubmission?.inputUrl === googleMapUrl
    const submittedAt =
        sameInputUrlAsExisting && existingSubmission?.submittedAt
            ? existingSubmission.submittedAt
            : timestamp
    const defaultSchedulingLane =
        effectiveEntitlement.effectivePolicy.sourceSubmissionLane
    const existingSchedulingLaneSource =
        existingSubmission?.schedulingLaneSource ??
        RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ENTITLEMENT_DEFAULT
    const preserveAdminOverrideLane =
        sameInputUrlAsExisting &&
        existingSchedulingLaneSource ===
            RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ADMIN_OVERRIDE
    const schedulingLane = preserveAdminOverrideLane
        ? existingSubmission?.schedulingLane ?? defaultSchedulingLane
        : defaultSchedulingLane
    const schedulingLaneSource = preserveAdminOverrideLane
        ? RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ADMIN_OVERRIDE
        : RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ENTITLEMENT_DEFAULT
    const canonicalCid = analysis?.resolved?.place?.identifiers?.cid ?? null
    const normalizedUrl = analysis?.resolved?.source?.resolvedUrl ?? null
    const persistedStatus = derivePersistedSourceSubmissionStatus({
        analysis,
        linkedSourceId: analysis?.sameRestaurantSource?.id ?? null,
    })
    const preservedClaim =
        sameInputUrlAsExisting &&
        persistedStatus !== PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE
            ? {
                  claimedByUserId: existingSubmission?.claimedByUserId ?? null,
                  claimedAt: existingSubmission?.claimedAt ?? null,
                  claimExpiresAt: existingSubmission?.claimExpiresAt ?? null,
              }
            : {
                  claimedByUserId: null,
                  claimedAt: null,
                  claimExpiresAt: null,
              }
    const submissionData = {
        submittedByUserId: userId,
        linkedSourceId: analysis?.sameRestaurantSource?.id ?? null,
        provider: 'GOOGLE_MAPS',
        inputUrl: googleMapUrl,
        normalizedUrl,
        canonicalCid,
        placeHexId: analysis?.resolved?.place?.identifiers?.placeHexId ?? null,
        googlePlaceId: analysis?.resolved?.place?.identifiers?.googlePlaceId ?? null,
        placeName: analysis?.resolved?.place?.name ?? null,
        dedupeKey: deriveSourceSubmissionDedupeKey({
            canonicalCid,
            normalizedUrl,
            inputUrl: googleMapUrl,
        }),
        status: persistedStatus,
        schedulingLane,
        schedulingLaneSource,
        ...preservedClaim,
        recommendationCode:
            analysis?.recommendationCode ??
            SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION.SUBMIT_FOR_ADMIN_SYNC,
        recommendationMessage:
            analysis?.recommendationMessage ??
            'Google Maps URL was saved. Admin still needs to confirm the exact place before sync can start.',
        submittedAt,
        lastResolvedAt: analysis ? timestamp : null,
    }

    return tx.restaurantSourceSubmission.upsert({
        where: {
            restaurantId,
        },
        create: {
            restaurantId,
            ...submissionData,
        },
        update: submissionData,
        select: {
            id: true,
            restaurantId: true,
            provider: true,
            status: true,
            inputUrl: true,
            normalizedUrl: true,
            canonicalCid: true,
            placeName: true,
            googlePlaceId: true,
            placeHexId: true,
            dedupeKey: true,
            schedulingLane: true,
            schedulingLaneSource: true,
            recommendationCode: true,
            recommendationMessage: true,
            linkedSourceId: true,
            submittedAt: true,
            lastResolvedAt: true,
        },
    })
}

async function appendMerchantSourceAuditEvent({
    userId,
    restaurantId,
    restaurantName,
    previousGoogleMapUrl,
    nextGoogleMapUrl,
    sourceSubmissionSnapshot = null,
    tx = prisma,
}) {
    if (previousGoogleMapUrl === nextGoogleMapUrl) {
        return
    }

    let action = 'MERCHANT_SOURCE_UPDATED'
    let summary = `Merchant updated the Google Maps URL for ${restaurantName}.`

    if (!previousGoogleMapUrl && nextGoogleMapUrl) {
        action = 'MERCHANT_SOURCE_SUBMITTED'
        summary = `Merchant submitted a Google Maps URL for ${restaurantName}.`
    } else if (previousGoogleMapUrl && !nextGoogleMapUrl) {
        action = 'MERCHANT_SOURCE_CLEARED'
        summary = `Merchant cleared the Google Maps URL for ${restaurantName}.`
    }

    await appendAuditEvent(
        {
            action,
            resourceType: 'restaurantSourceSubmission',
            resourceId: restaurantId,
            restaurantId,
            actorUserId: userId,
            summary,
            metadata: {
                previousGoogleMapUrl: previousGoogleMapUrl ?? null,
                nextGoogleMapUrl: nextGoogleMapUrl ?? null,
                sourceSubmissionSnapshot,
            },
        },
        { tx },
    )
}

module.exports = {
    appendMerchantSourceAuditEvent,
    syncSourceSubmissionRecord,
}
