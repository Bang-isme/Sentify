const crypto = require('node:crypto')

const { getRestaurantAccess } = require('./restaurant-access.service')
const { buildInsightSummary } = require('./insight.service')
const {
    ensureRestaurantEntitlement,
    getEffectiveRestaurantEntitlement,
    mapRestaurantEntitlement,
    RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE,
} = require('./restaurant-entitlement.service')
const {
    PERSISTED_SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION,
    SOURCE_SUBMISSION_SCHEDULING_LANE,
    analyzeGoogleMapsSourceSubmission,
    buildDatasetStatus,
    buildSourceSubmissionAuditSnapshot,
    derivePersistedSourceSubmissionStatus,
    deriveSourceSubmissionDedupeKey,
    fetchIntakeSummary,
} = require('./restaurant-state.service')
const {
    SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
    SOURCE_SUBMISSION_HISTORY_EVENT,
    SOURCE_SUBMISSION_STATUS,
    buildInitialSourceSubmission,
    buildRestaurantSourceSubmissionHistory,
    buildSourceSubmissionAttemptKey,
    buildSourceSubmissionFromState,
    buildSourceSubmissionHistory,
    buildSourceSubmissionTimeline,
    deriveCurrentTimelineStepCode,
    deriveSourceSubmissionTimelineCodeFromAuditAction,
    extractSourceSubmissionAuditSnapshot,
} = require('./restaurant-source-submission-view.service')
const {
    buildCurrentSourceSubmission,
    fetchPersistedSourceSubmissionRecord,
    fetchRestaurantSourceSubmissionHistoryAuditEvents,
    fetchSourceSubmissionAuditEvents,
    fetchSourceSubmissionState,
} = require('./restaurant-source-submission-read.service')
const {
    appendMerchantSourceAuditEvent,
    syncSourceSubmissionRecord,
} = require('./restaurant-source-submission-write.service')
const prisma = require('../lib/prisma')

function mapRestaurantEntitlementResponse(restaurantId, entitlement = null) {
    return mapRestaurantEntitlement({
        id: entitlement?.id ?? null,
        restaurantId,
        planTier: entitlement?.planTier ?? null,
        createdAt: entitlement?.createdAt ?? null,
        updatedAt: entitlement?.updatedAt ?? null,
    })
}

function slugifyName(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
}

async function generateUniqueSlug(name) {
    const baseSlug = slugifyName(name) || 'restaurant'

    for (let attempt = 0; attempt < 100; attempt += 1) {
        // Retry with numeric suffixes so restaurant URLs stay stable without manual slug input.
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
        const existingRestaurant = await prisma.restaurant.findUnique({
            where: { slug },
            select: { id: true },
        })

        if (!existingRestaurant) {
            return slug
        }
    }

    throw new Error('Unable to generate a unique restaurant slug')
}

async function previewSourceSubmission({ userId, restaurantId, googleMapUrl, language = 'en', region = 'us' }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
    })

    const analysis = await analyzeGoogleMapsSourceSubmission({
        restaurantId,
        googleMapUrl,
        savedGoogleMapUrl: access.restaurant.googleMapUrl,
        language,
        region,
    })

    return {
        submittedUrl: googleMapUrl,
        normalizedUrl: analysis.resolved.source.resolvedUrl ?? null,
        currentRestaurant: {
            id: access.restaurant.id,
            name: access.restaurant.name,
            savedGoogleMapUrl: access.restaurant.googleMapUrl ?? null,
            exactSavedUrlMatches: analysis.exactSavedUrlMatches,
        },
        canonicalIdentity: {
            provider: 'GOOGLE_MAPS',
            canonicalCid: analysis.resolved.place.identifiers.cid,
            placeName: analysis.resolved.place.name ?? null,
            googlePlaceId: analysis.resolved.place.identifiers.googlePlaceId ?? null,
            placeHexId: analysis.resolved.place.identifiers.placeHexId ?? null,
            totalReviewCount: analysis.resolved.place.totalReviewCount ?? null,
        },
        dedupe: {
            sameRestaurantSourceExists: analysis.sameRestaurantSourceExists,
            otherRestaurantCount: analysis.otherRestaurantCount,
            sharedPlaceAlreadyKnown:
                analysis.sameRestaurantSourceExists || analysis.otherRestaurantCount > 0,
        },
        recommendation: {
            code: analysis.recommendationCode,
            message: analysis.recommendationMessage,
            canSubmit: true,
            shouldReplaceSavedUrl: !analysis.exactSavedUrlMatches,
        },
    }
}

async function createRestaurant(input) {
    const name = input.name.trim()
    const address = input.address?.trim() || null
    const googleMapUrl = input.googleMapUrl?.trim() || null
    const slug = await generateUniqueSlug(name)
    const restaurantId = crypto.randomUUID()
    let sourceSubmissionAnalysis = null

    if (googleMapUrl) {
        try {
            sourceSubmissionAnalysis = await analyzeGoogleMapsSourceSubmission({
                restaurantId,
                googleMapUrl,
                savedGoogleMapUrl: googleMapUrl,
            })
        } catch {
            sourceSubmissionAnalysis = null
        }
    }

    // Restaurant creation and membership insertion must commit together so the user can land in the
    // merchant flow immediately after onboarding.
    const result = await prisma.$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({
            data: {
                id: restaurantId,
                name,
                slug,
                address,
                googleMapUrl,
            },
        })

        await tx.restaurantUser.create({
            data: {
                userId: input.userId,
                restaurantId: restaurant.id,
            },
        })

        await ensureRestaurantEntitlement({
            restaurantId: restaurant.id,
            tx,
        })

        const syncedSubmission = await syncSourceSubmissionRecord({
            restaurantId: restaurant.id,
            userId: input.userId,
            googleMapUrl: restaurant.googleMapUrl,
            savedGoogleMapUrl: restaurant.googleMapUrl,
            tx,
            analysis: sourceSubmissionAnalysis,
        })

        await appendMerchantSourceAuditEvent({
            userId: input.userId,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            previousGoogleMapUrl: null,
            nextGoogleMapUrl: restaurant.googleMapUrl,
            sourceSubmissionSnapshot:
                buildSourceSubmissionAuditSnapshot(syncedSubmission),
            tx,
        })

        return {
            restaurant,
            syncedSubmission,
        }
    })

    const [sourceSubmission, entitlement] = await Promise.all([
        buildCurrentSourceSubmission(
            result.restaurant.id,
            result.restaurant.googleMapUrl,
        ),
        getEffectiveRestaurantEntitlement(result.restaurant.id),
    ])

    return {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        address: result.restaurant.address,
        googleMapUrl: result.restaurant.googleMapUrl,
        createdAt: result.restaurant.createdAt,
        entitlement,
        sourceSubmission,
    }
}

async function listRestaurants({ userId }) {
    const memberships = await prisma.restaurantUser.findMany({
        where: {
            userId,
        },
        include: {
            restaurant: {
                include: {
                    entitlement: true,
                    _count: {
                        select: {
                            reviews: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    // Include review counts here so the restaurant picker can render lightweight summary data directly.
    return memberships.map((membership) => ({
        id: membership.restaurant.id,
        name: membership.restaurant.name,
        slug: membership.restaurant.slug,
        googleMapUrl: membership.restaurant.googleMapUrl,
        totalReviews: membership.restaurant._count.reviews,
        entitlement: mapRestaurantEntitlementResponse(
            membership.restaurant.id,
            membership.restaurant.entitlement,
        ),
    }))
}

async function getRestaurantDetail({ userId, restaurantId }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        restaurantInclude: {
            entitlement: true,
            insight: true,
        },
    })
    const intakeSummary = await fetchIntakeSummary(restaurantId)
    const sourceSubmission = await buildCurrentSourceSubmission(
        restaurantId,
        access.restaurant.googleMapUrl,
        intakeSummary.latestPublishedBatch,
    )

    return {
        id: access.restaurant.id,
        name: access.restaurant.name,
        slug: access.restaurant.slug,
        address: access.restaurant.address,
        googleMapUrl: access.restaurant.googleMapUrl,
        datasetStatus: buildDatasetStatus(intakeSummary),
        entitlement: mapRestaurantEntitlementResponse(
            access.restaurant.id,
            access.restaurantWithRelations.entitlement,
        ),
        sourceSubmission,
        insightSummary: buildInsightSummary(access.restaurantWithRelations.insight),
    }
}

async function getRestaurantSourceSubmissionHistory({ userId, restaurantId }) {
    const access = await getRestaurantAccess({
        userId,
        restaurantId,
        restaurantInclude: {
            entitlement: true,
            insight: true,
        },
    })
    const intakeSummary = await fetchIntakeSummary(restaurantId)
    const [submissionRecord, auditEvents] = await Promise.all([
        fetchPersistedSourceSubmissionRecord(restaurantId),
        fetchRestaurantSourceSubmissionHistoryAuditEvents(restaurantId),
    ])
    const currentSourceSubmission = await buildCurrentSourceSubmission(
        restaurantId,
        access.restaurant.googleMapUrl,
        intakeSummary.latestPublishedBatch,
    )
    const currentAttemptKey = submissionRecord
        ? buildSourceSubmissionAttemptKey(
              buildSourceSubmissionAuditSnapshot(submissionRecord),
              null,
          )
        : access.restaurant.googleMapUrl
          ? `current-url:${access.restaurant.googleMapUrl}`
          : null
    const history = buildRestaurantSourceSubmissionHistory(
        auditEvents,
        currentAttemptKey,
    )

    return {
        restaurant: {
            id: access.restaurant.id,
            name: access.restaurant.name,
            slug: access.restaurant.slug,
            googleMapUrl: access.restaurant.googleMapUrl ?? null,
            entitlement: mapRestaurantEntitlementResponse(
                access.restaurant.id,
                access.restaurantWithRelations.entitlement,
            ),
        },
        current: {
            attemptKey: currentAttemptKey,
            sourceSubmission: currentSourceSubmission,
        },
        history,
    }
}

async function updateRestaurant(input) {
    const access = await getRestaurantAccess({
        userId: input.userId,
        restaurantId: input.restaurantId,
    })

    const data = {}

    if (typeof input.name === 'string') {
        data.name = input.name.trim()
    }

    if (Object.prototype.hasOwnProperty.call(input, 'address')) {
        data.address = input.address?.trim() || null
    }

    if (Object.prototype.hasOwnProperty.call(input, 'googleMapUrl')) {
        data.googleMapUrl = input.googleMapUrl?.trim() || null
    }

    // Keep slug stable after creation so existing frontend links and references do not drift.
    const previousGoogleMapUrl = access.restaurant.googleMapUrl
    const previousSubmissionRecord = previousGoogleMapUrl
        ? await fetchPersistedSourceSubmissionRecord(access.restaurant.id)
        : null
    const hasGoogleMapUrlMutation = Object.prototype.hasOwnProperty.call(
        data,
        'googleMapUrl',
    )
    let sourceSubmissionAnalysis = null

    if (hasGoogleMapUrlMutation && data.googleMapUrl) {
        try {
            sourceSubmissionAnalysis = await analyzeGoogleMapsSourceSubmission({
                restaurantId: access.restaurant.id,
                googleMapUrl: data.googleMapUrl,
                savedGoogleMapUrl: data.googleMapUrl,
            })
        } catch {
            sourceSubmissionAnalysis = null
        }
    }

    const { restaurant } = await prisma.$transaction(async (tx) => {
        const nextRestaurant = await tx.restaurant.update({
            where: {
                id: access.restaurant.id,
            },
            data,
        })

        const syncedSubmission = hasGoogleMapUrlMutation
            ? await syncSourceSubmissionRecord({
                  restaurantId: nextRestaurant.id,
                  userId: input.userId,
                  googleMapUrl: nextRestaurant.googleMapUrl,
                  savedGoogleMapUrl: nextRestaurant.googleMapUrl,
                  tx,
                  analysis: sourceSubmissionAnalysis,
              })
            : previousSubmissionRecord

        await appendMerchantSourceAuditEvent({
            userId: input.userId,
            restaurantId: nextRestaurant.id,
            restaurantName: nextRestaurant.name,
            previousGoogleMapUrl,
            nextGoogleMapUrl: nextRestaurant.googleMapUrl,
            sourceSubmissionSnapshot:
                buildSourceSubmissionAuditSnapshot(
                    syncedSubmission ?? previousSubmissionRecord,
                ),
            tx,
        })

        return {
            restaurant: nextRestaurant,
        }
    })

    const [sourceSubmission, entitlement] = await Promise.all([
        buildCurrentSourceSubmission(restaurant.id, restaurant.googleMapUrl),
        getEffectiveRestaurantEntitlement(restaurant.id),
    ])

    return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        googleMapUrl: restaurant.googleMapUrl,
        updatedAt: restaurant.updatedAt,
        entitlement,
        sourceSubmission,
    }
}

module.exports = {
    createRestaurant,
    getRestaurantDetail,
    getRestaurantSourceSubmissionHistory,
    listRestaurants,
    previewSourceSubmission,
    updateRestaurant,
    __private: {
        buildRestaurantSourceSubmissionHistory,
        buildSourceSubmissionAttemptKey,
        buildSourceSubmissionAuditSnapshot,
        buildDatasetStatus,
        buildInitialSourceSubmission,
        buildSourceSubmissionFromState,
        analyzeGoogleMapsSourceSubmission,
        buildSourceSubmissionHistory,
        derivePersistedSourceSubmissionStatus,
        deriveSourceSubmissionDedupeKey,
        deriveCurrentTimelineStepCode,
        fetchPersistedSourceSubmissionRecord,
        fetchSourceSubmissionState,
        fetchSourceSubmissionAuditEvents,
        fetchIntakeSummary,
        PERSISTED_SOURCE_SUBMISSION_STATUS,
        SOURCE_SUBMISSION_SCHEDULING_LANE,
        SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION,
        SOURCE_SUBMISSION_HISTORY_EVENT,
        SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
        SOURCE_SUBMISSION_STATUS,
        buildSourceSubmissionTimeline,
        extractSourceSubmissionAuditSnapshot,
        deriveSourceSubmissionTimelineCodeFromAuditAction,
        syncSourceSubmissionRecord,
    },
}
