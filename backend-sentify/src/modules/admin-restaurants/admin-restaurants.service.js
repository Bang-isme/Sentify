const prisma = require('../../lib/prisma')
const { badRequest, notFound } = require('../../lib/app-error')
const { INTERNAL_OPERATOR_ROLES } = require('../../lib/user-roles')
const { appendAuditEvent } = require('../../services/audit-event.service')
const {
    mapRestaurantEntitlement,
    upsertRestaurantEntitlement,
    RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE,
} = require('../../services/restaurant-entitlement.service')
const { buildInsightSummary } = require('../../services/insight.service')
const { ensureRestaurantExists } = require('../../services/restaurant-access.service')
const { getUserRoleAccess } = require('../../services/user-access.service')
const { __private: restaurantPrivate } = require('../../services/restaurant.service')
const reviewCrawlService = require('../review-crawl/review-crawl.service')
const { summarizeBatchItems } = require('../admin-intake/admin-intake.domain')

const OPEN_BATCH_STATUSES = ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH']
const SOURCE_SUBMISSION_QUEUE_STATE = Object.freeze({
    RESOLVE_IDENTITY: 'RESOLVE_IDENTITY',
    REUSE_SHARED_IDENTITY: 'REUSE_SHARED_IDENTITY',
    CREATE_SOURCE: 'CREATE_SOURCE',
    ALREADY_LINKED: 'ALREADY_LINKED',
})
const SOURCE_SUBMISSION_QUEUE_PRIORITY = Object.freeze({
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    NORMAL: 'NORMAL',
})
const DEFAULT_SOURCE_SUBMISSION_CLAIM_LEASE_MINUTES = 15
const ACTIONABLE_PERSISTED_SOURCE_SUBMISSION_STATUSES = [
    restaurantPrivate.PERSISTED_SOURCE_SUBMISSION_STATUS.PENDING_IDENTITY_RESOLUTION,
    restaurantPrivate.PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK,
]
const SOURCE_SUBMISSION_SELECT = {
    id: true,
    restaurantId: true,
    submittedByUserId: true,
    linkedSourceId: true,
    provider: true,
    inputUrl: true,
    normalizedUrl: true,
    canonicalCid: true,
    placeHexId: true,
    googlePlaceId: true,
    placeName: true,
    dedupeKey: true,
    status: true,
    schedulingLane: true,
    schedulingLaneSource: true,
    claimedByUserId: true,
    claimedAt: true,
    claimExpiresAt: true,
    recommendationCode: true,
    recommendationMessage: true,
    submittedAt: true,
    lastResolvedAt: true,
    createdAt: true,
    updatedAt: true,
    restaurant: {
        select: {
            id: true,
            name: true,
            slug: true,
            googleMapUrl: true,
        },
    },
}

async function ensureAdminAccess(userId) {
    return getUserRoleAccess({
        userId,
        allowedRoles: INTERNAL_OPERATOR_ROLES,
    })
}

function mapBatchSummary(batch) {
    const counts = summarizeBatchItems(batch.items || [])

    return {
        id: batch.id,
        title: batch.title ?? null,
        sourceType: batch.sourceType,
        status: batch.status,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        counts,
    }
}

function mapLatestRun(run) {
    if (!run) {
        return null
    }

    return {
        id: run.id,
        status: run.status,
        strategy: run.strategy,
        priority: run.priority,
        extractedCount: run.extractedCount,
        validCount: run.validCount,
        warningCount: run.warningCount,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        sourceId: run.sourceId,
        intakeBatchId: run.intakeBatchId ?? null,
    }
}

function getQueuePriorityScore(priority) {
    if (priority === SOURCE_SUBMISSION_QUEUE_PRIORITY.HIGH) {
        return 3
    }

    if (priority === SOURCE_SUBMISSION_QUEUE_PRIORITY.MEDIUM) {
        return 2
    }

    return 1
}

function getSchedulingLaneScore(schedulingLane) {
    if (
        schedulingLane ===
        restaurantPrivate.SOURCE_SUBMISSION_SCHEDULING_LANE.PRIORITY
    ) {
        return 2
    }

    return 1
}

function addMinutes(value, minutes) {
    return new Date(value.getTime() + minutes * 60 * 1000)
}

function isSourceSubmissionClaimActive(claimExpiresAt, now = new Date()) {
    if (!claimExpiresAt) {
        return false
    }

    return new Date(claimExpiresAt).getTime() > now.getTime()
}

function mapSourceSubmissionClaim(submission, now = new Date()) {
    if (!submission?.claimedByUserId && !submission?.claimedAt && !submission?.claimExpiresAt) {
        return null
    }

    return {
        claimedByUserId: submission.claimedByUserId ?? null,
        claimedAt: submission.claimedAt ?? null,
        claimExpiresAt: submission.claimExpiresAt ?? null,
        isActive: isSourceSubmissionClaimActive(submission.claimExpiresAt, now),
    }
}

function deriveSourceSubmissionPriority(queueState, schedulingLane) {
    if (
        schedulingLane ===
        restaurantPrivate.SOURCE_SUBMISSION_SCHEDULING_LANE.PRIORITY
    ) {
        return SOURCE_SUBMISSION_QUEUE_PRIORITY.HIGH
    }

    if (queueState === SOURCE_SUBMISSION_QUEUE_STATE.RESOLVE_IDENTITY) {
        return SOURCE_SUBMISSION_QUEUE_PRIORITY.HIGH
    }

    if (queueState === SOURCE_SUBMISSION_QUEUE_STATE.REUSE_SHARED_IDENTITY) {
        return SOURCE_SUBMISSION_QUEUE_PRIORITY.MEDIUM
    }

    return SOURCE_SUBMISSION_QUEUE_PRIORITY.NORMAL
}

function buildSourceSubmissionNextAction(workItem) {
    if (workItem.queueState === SOURCE_SUBMISSION_QUEUE_STATE.RESOLVE_IDENTITY) {
        return 'Resolve the submitted Google Maps URL into a canonical place before admin sync can continue.'
    }

    if (workItem.queueState === SOURCE_SUBMISSION_QUEUE_STATE.REUSE_SHARED_IDENTITY) {
        return 'Review the shared canonical place and reuse that identity when creating the restaurant-specific crawl source.'
    }

    if (workItem.queueState === SOURCE_SUBMISSION_QUEUE_STATE.ALREADY_LINKED) {
        return 'The submitted place is already linked to a crawl source for this restaurant.'
    }

    return 'Create a crawl source from the merchant-submitted Google Maps place so sync-to-draft can start.'
}

function mapSourceSubmissionRestaurantItem(workItem) {
    return {
        submissionId: workItem.submissionId,
        restaurantId: workItem.restaurantId,
        restaurantName: workItem.restaurantName,
        restaurantSlug: workItem.restaurantSlug,
        inputUrl: workItem.inputUrl,
        normalizedUrl: workItem.normalizedUrl,
        dedupeKey: workItem.dedupeKey,
        submittedAt: workItem.submittedAt,
        queueState: workItem.queueState,
        priority: workItem.priority,
        schedulingLane: workItem.schedulingLane,
        linkedSourceId: workItem.linkedSourceId,
        otherRestaurantCount: workItem.otherRestaurantCount,
        claim: workItem.claim,
    }
}

function mapPersistedSourceSubmission(submission) {
    if (!submission) {
        return null
    }

    return {
        id: submission.id,
        restaurantId: submission.restaurantId,
        provider: submission.provider,
        status: submission.status,
        inputUrl: submission.inputUrl,
        normalizedUrl: submission.normalizedUrl ?? null,
        canonicalCid: submission.canonicalCid ?? null,
        placeName: submission.placeName ?? null,
        googlePlaceId: submission.googlePlaceId ?? null,
        placeHexId: submission.placeHexId ?? null,
        dedupeKey: submission.dedupeKey ?? null,
        schedulingLane: submission.schedulingLane ?? null,
        schedulingLaneSource: submission.schedulingLaneSource ?? null,
        claim: mapSourceSubmissionClaim(submission),
        recommendationCode: submission.recommendationCode ?? null,
        recommendationMessage: submission.recommendationMessage ?? null,
        linkedSourceId: submission.linkedSourceId ?? null,
        submittedAt: submission.submittedAt,
        lastResolvedAt: submission.lastResolvedAt ?? null,
        restaurant: submission.restaurant
            ? {
                  id: submission.restaurant.id,
                  name: submission.restaurant.name,
                  slug: submission.restaurant.slug,
                  googleMapUrl: submission.restaurant.googleMapUrl ?? null,
              }
            : null,
    }
}

async function ensureSourceSubmissionAccess(userId, submissionId) {
    await ensureAdminAccess(userId)

    const submission = await prisma.restaurantSourceSubmission.findUnique({
        where: {
            id: submissionId,
        },
        select: SOURCE_SUBMISSION_SELECT,
    })

    if (!submission) {
        throw notFound('NOT_FOUND', 'Restaurant source submission not found')
    }

    return submission
}

function buildResolvedPlaceFromSubmission(submission) {
    return {
        source: {
            resolvedUrl: submission.normalizedUrl ?? submission.inputUrl,
        },
        place: {
            name: submission.placeName ?? null,
            totalReviewCount: null,
            identifiers: {
                cid: submission.canonicalCid ?? null,
                placeHexId: submission.placeHexId ?? null,
                googlePlaceId: submission.googlePlaceId ?? null,
            },
        },
    }
}

async function resolveAdminSourceSubmission({
    userId,
    submissionId,
    input = {},
}) {
    const submission = await ensureSourceSubmissionAccess(userId, submissionId)
    const analysis = await restaurantPrivate.analyzeGoogleMapsSourceSubmission({
        restaurantId: submission.restaurantId,
        googleMapUrl: submission.inputUrl,
        savedGoogleMapUrl: submission.restaurant?.googleMapUrl ?? submission.inputUrl,
        language: input.language,
        region: input.region,
    })
    const nextStatus = restaurantPrivate.derivePersistedSourceSubmissionStatus({
        analysis,
        linkedSourceId: analysis.sameRestaurantSource?.id ?? null,
    })

    const resolvedAt = new Date()
    const updatedSubmission = await prisma.restaurantSourceSubmission.update({
        where: {
            id: submission.id,
        },
        data: {
            linkedSourceId: analysis.sameRestaurantSource?.id ?? null,
            normalizedUrl: analysis.resolved.source?.resolvedUrl ?? null,
            canonicalCid: analysis.resolved.place?.identifiers?.cid ?? null,
            placeHexId: analysis.resolved.place?.identifiers?.placeHexId ?? null,
            googlePlaceId: analysis.resolved.place?.identifiers?.googlePlaceId ?? null,
            placeName: analysis.resolved.place?.name ?? null,
            dedupeKey: restaurantPrivate.deriveSourceSubmissionDedupeKey({
                canonicalCid: analysis.resolved.place?.identifiers?.cid ?? null,
                normalizedUrl: analysis.resolved.source?.resolvedUrl ?? null,
                inputUrl: submission.inputUrl,
            }),
            status: nextStatus,
            ...(nextStatus === restaurantPrivate.PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE
                ? {
                      claimedByUserId: null,
                      claimedAt: null,
                      claimExpiresAt: null,
                  }
                : {}),
            recommendationCode: analysis.recommendationCode,
            recommendationMessage: analysis.recommendationMessage,
            lastResolvedAt: resolvedAt,
        },
        select: SOURCE_SUBMISSION_SELECT,
    })

    await appendAuditEvent({
        action: 'ADMIN_SOURCE_SUBMISSION_RESOLVED',
        resourceType: 'restaurantSourceSubmission',
        resourceId: updatedSubmission.id,
        restaurantId: updatedSubmission.restaurantId,
        actorUserId: userId,
        summary: `Admin resolved the merchant-submitted Google Maps place for ${updatedSubmission.restaurant.name}.`,
        metadata: {
            previous: mapPersistedSourceSubmission(submission),
            current: mapPersistedSourceSubmission(updatedSubmission),
            sourceSubmissionSnapshot:
                restaurantPrivate.buildSourceSubmissionAuditSnapshot(
                    updatedSubmission,
                ),
        },
    })

    return {
        submission: mapPersistedSourceSubmission(updatedSubmission),
    }
}

async function createSourceFromSubmission({
    userId,
    submissionId,
    input = {},
}) {
    const submission = await ensureSourceSubmissionAccess(userId, submissionId)

    if (!submission.canonicalCid) {
        throw badRequest(
            'RESTAURANT_SOURCE_SUBMISSION_UNRESOLVED',
            'Resolve this merchant-submitted Google Maps place before creating a crawl source',
        )
    }

    const createdSource = await reviewCrawlService.upsertReviewCrawlSourceFromResolvedPlace({
        userId,
        input: {
            restaurantId: submission.restaurantId,
            url: submission.inputUrl,
            language: input.language,
            region: input.region,
            syncEnabled: input.syncEnabled,
            syncIntervalMinutes: input.syncIntervalMinutes,
        },
        resolved: buildResolvedPlaceFromSubmission(submission),
    })

    const updatedSubmission = await prisma.restaurantSourceSubmission.update({
        where: {
            id: submission.id,
        },
        data: {
            linkedSourceId: createdSource.source.id,
            normalizedUrl: createdSource.source.resolvedUrl ?? submission.normalizedUrl ?? submission.inputUrl,
            canonicalCid: createdSource.source.canonicalCid ?? submission.canonicalCid,
            placeHexId: createdSource.source.placeHexId ?? submission.placeHexId,
            googlePlaceId: createdSource.source.googlePlaceId ?? submission.googlePlaceId,
            placeName:
                createdSource.source.placeName ??
                createdSource.metadata.placeName ??
                submission.placeName ??
                null,
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            dedupeKey: restaurantPrivate.deriveSourceSubmissionDedupeKey({
                canonicalCid: createdSource.source.canonicalCid ?? submission.canonicalCid,
                normalizedUrl:
                    createdSource.source.resolvedUrl ??
                    submission.normalizedUrl ??
                    submission.inputUrl,
                inputUrl: submission.inputUrl,
            }),
            status: restaurantPrivate.PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE,
            recommendationCode:
                restaurantPrivate.SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION.ALREADY_CONNECTED,
            recommendationMessage:
                'This Google Maps place is already connected to your restaurant.',
        },
        select: SOURCE_SUBMISSION_SELECT,
    })

    await appendAuditEvent({
        action: 'ADMIN_SOURCE_SUBMISSION_LINKED',
        resourceType: 'restaurantSourceSubmission',
        resourceId: updatedSubmission.id,
        restaurantId: updatedSubmission.restaurantId,
        actorUserId: userId,
        summary: `Admin linked the merchant-submitted Google Maps place for ${updatedSubmission.restaurant.name} to a crawl source.`,
        metadata: {
            previous: mapPersistedSourceSubmission(submission),
            current: mapPersistedSourceSubmission(updatedSubmission),
            crawlSourceId: createdSource.source.id,
            sourceSubmissionSnapshot:
                restaurantPrivate.buildSourceSubmissionAuditSnapshot(
                    updatedSubmission,
                ),
        },
    })

    return {
        submission: mapPersistedSourceSubmission(updatedSubmission),
        source: createdSource.source,
    }
}

async function updateSourceSubmissionSchedulingLane({
    userId,
    submissionId,
    input = {},
}) {
    const submission = await ensureSourceSubmissionAccess(userId, submissionId)

    if (
        submission.schedulingLane === input.schedulingLane &&
        submission.schedulingLaneSource ===
            RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ADMIN_OVERRIDE
    ) {
        return {
            submission: mapPersistedSourceSubmission(submission),
        }
    }

    const updatedSubmission = await prisma.restaurantSourceSubmission.update({
        where: {
            id: submission.id,
        },
        data: {
            schedulingLane: input.schedulingLane,
            schedulingLaneSource:
                RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ADMIN_OVERRIDE,
        },
        select: SOURCE_SUBMISSION_SELECT,
    })

    await appendAuditEvent({
        action: 'ADMIN_SOURCE_SUBMISSION_SCHEDULING_LANE_UPDATED',
        resourceType: 'restaurantSourceSubmission',
        resourceId: updatedSubmission.id,
        restaurantId: updatedSubmission.restaurantId,
        actorUserId: userId,
        summary: `Admin moved the merchant source submission for ${updatedSubmission.restaurant.name} into the ${updatedSubmission.schedulingLane.toLowerCase()} scheduling lane.`,
        metadata: {
            previous: mapPersistedSourceSubmission(submission),
            current: mapPersistedSourceSubmission(updatedSubmission),
            sourceSubmissionSnapshot:
                restaurantPrivate.buildSourceSubmissionAuditSnapshot(
                    updatedSubmission,
                ),
        },
    })

    return {
        submission: mapPersistedSourceSubmission(updatedSubmission),
    }
}

async function claimNextSourceSubmissionGroup({
    userId,
    input = {},
}) {
    await ensureAdminAccess(userId)

    const leaseMinutes = input.leaseMinutes ?? DEFAULT_SOURCE_SUBMISSION_CLAIM_LEASE_MINUTES
    const queue = await fetchSourceSubmissionQueue()
    const claimedAt = new Date()
    const claimExpiresAt = addMinutes(claimedAt, leaseMinutes)

    for (const group of queue.groups) {
        if (group.claim?.isActive) {
            continue
        }

        const updateResult = await prisma.restaurantSourceSubmission.updateMany({
            where: {
                provider: 'GOOGLE_MAPS',
                status: {
                    in: ACTIONABLE_PERSISTED_SOURCE_SUBMISSION_STATUSES,
                },
                dedupeKey: group.groupKey,
                OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lte: claimedAt } }],
            },
            data: {
                claimedByUserId: userId,
                claimedAt,
                claimExpiresAt,
            },
        })

        if (updateResult.count !== group.restaurantCount) {
            continue
        }

        const refreshedQueue = await fetchSourceSubmissionQueue()
        const claimedGroup =
            refreshedQueue.groups.find((candidate) => candidate.groupKey === group.groupKey) ?? null

        if (claimedGroup) {
            await appendAuditEvent({
                action: 'ADMIN_SOURCE_SUBMISSION_GROUP_CLAIMED',
                resourceType: 'restaurantSourceSubmissionGroup',
                resourceId: claimedGroup.groupKey,
                actorUserId: userId,
                summary: `Admin claimed the ${claimedGroup.schedulingLane.toLowerCase()} merchant source-submission group ${claimedGroup.groupKey} for ${leaseMinutes} minutes.`,
                metadata: {
                    leaseMinutes,
                    queueState: claimedGroup.queueState,
                    schedulingLane: claimedGroup.schedulingLane,
                    restaurantIds: claimedGroup.restaurants.map((restaurant) => restaurant.restaurantId),
                    submissionIds: claimedGroup.restaurants.map((restaurant) => restaurant.submissionId),
                    currentClaim: claimedGroup.claim,
                },
            })
        }

        return {
            group: claimedGroup,
            leaseMinutes,
        }
    }

    return {
        group: null,
        leaseMinutes,
    }
}

async function fetchSourceSubmissionQueue({ restaurantId = null } = {}) {
    const submissions = await prisma.restaurantSourceSubmission.findMany({
        where: {
            provider: 'GOOGLE_MAPS',
            status: {
                in: ACTIONABLE_PERSISTED_SOURCE_SUBMISSION_STATUSES,
            },
            ...(restaurantId
                ? {
                      restaurantId,
                  }
                : {}),
        },
        select: {
            id: true,
            restaurantId: true,
            inputUrl: true,
            normalizedUrl: true,
            canonicalCid: true,
            placeName: true,
            googlePlaceId: true,
            placeHexId: true,
            dedupeKey: true,
            schedulingLane: true,
            claimedByUserId: true,
            claimedAt: true,
            claimExpiresAt: true,
            recommendationCode: true,
            recommendationMessage: true,
            linkedSourceId: true,
            submittedAt: true,
            lastResolvedAt: true,
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    googleMapUrl: true,
                },
            },
        },
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    })

    if (submissions.length === 0) {
        return {
            summary: {
                totalSubmissions: 0,
                actionableCount: 0,
                dedupedGroupCount: 0,
                unresolvedCount: 0,
                reuseSharedIdentityCount: 0,
                createSourceCount: 0,
                priorityLaneCount: 0,
                claimedGroupCount: 0,
                availableGroupCount: 0,
                linkedButStaleCount: 0,
            },
            groups: [],
            restaurantItems: new Map(),
        }
    }

    const canonicalCids = [...new Set(submissions.map((submission) => submission.canonicalCid).filter(Boolean))]
    const inputUrls = [...new Set(submissions.map((submission) => submission.inputUrl).filter(Boolean))]
    const restaurantIds = [...new Set(submissions.map((submission) => submission.restaurantId))]
    const sourceWhereClauses = []

    if (canonicalCids.length > 0) {
        sourceWhereClauses.push({
            provider: 'GOOGLE_MAPS',
            canonicalCid: {
                in: canonicalCids,
            },
        })
    }

    if (inputUrls.length > 0 && restaurantIds.length > 0) {
        sourceWhereClauses.push({
            restaurantId: {
                in: restaurantIds,
            },
            inputUrl: {
                in: inputUrls,
            },
        })
    }

    const sourceMatches =
        sourceWhereClauses.length > 0
            ? await prisma.reviewCrawlSource.findMany({
                  where: {
                      OR: sourceWhereClauses,
                  },
                  select: {
                      id: true,
                      restaurantId: true,
                      canonicalCid: true,
                      inputUrl: true,
                      status: true,
                      syncEnabled: true,
                  },
              })
            : []

    const sourceMatchesByCanonicalCid = new Map()
    const sourceMatchesByRestaurantInput = new Map()

    for (const source of sourceMatches) {
        if (source.canonicalCid) {
            const existing = sourceMatchesByCanonicalCid.get(source.canonicalCid) ?? []
            existing.push(source)
            sourceMatchesByCanonicalCid.set(source.canonicalCid, existing)
        }

        const restaurantInputKey = `${source.restaurantId}:${source.inputUrl}`
        sourceMatchesByRestaurantInput.set(restaurantInputKey, source)
    }

    const workItems = submissions.map((submission) => {
        const sameRestaurantSource = submission.canonicalCid
            ? (sourceMatchesByCanonicalCid.get(submission.canonicalCid) ?? []).find(
                  (source) => source.restaurantId === submission.restaurantId,
              ) ?? null
            : sourceMatchesByRestaurantInput.get(`${submission.restaurantId}:${submission.inputUrl}`) ?? null

        const otherRestaurantCount = submission.canonicalCid
            ? new Set(
                  (sourceMatchesByCanonicalCid.get(submission.canonicalCid) ?? [])
                      .filter((source) => source.restaurantId !== submission.restaurantId)
                      .map((source) => source.restaurantId),
              ).size
            : 0

        let queueState = SOURCE_SUBMISSION_QUEUE_STATE.CREATE_SOURCE

        if (sameRestaurantSource) {
            queueState = SOURCE_SUBMISSION_QUEUE_STATE.ALREADY_LINKED
        } else if (
            submission.status ===
                restaurantPrivate.PERSISTED_SOURCE_SUBMISSION_STATUS.PENDING_IDENTITY_RESOLUTION ||
            !submission.canonicalCid
        ) {
            queueState = SOURCE_SUBMISSION_QUEUE_STATE.RESOLVE_IDENTITY
        } else if (otherRestaurantCount > 0) {
            queueState = SOURCE_SUBMISSION_QUEUE_STATE.REUSE_SHARED_IDENTITY
        }

        const dedupeKey =
            submission.dedupeKey ??
            restaurantPrivate.deriveSourceSubmissionDedupeKey({
                canonicalCid: submission.canonicalCid ?? null,
                normalizedUrl: submission.normalizedUrl ?? null,
                inputUrl: submission.inputUrl,
            })
        const schedulingLane =
            submission.schedulingLane ??
            restaurantPrivate.SOURCE_SUBMISSION_SCHEDULING_LANE.STANDARD
        const priority = deriveSourceSubmissionPriority(queueState, schedulingLane)
        const claim = mapSourceSubmissionClaim(submission)

        return {
            submissionId: submission.id,
            restaurantId: submission.restaurant.id,
            restaurantName: submission.restaurant.name,
            restaurantSlug: submission.restaurant.slug,
            inputUrl: submission.inputUrl,
            normalizedUrl: submission.normalizedUrl ?? null,
            dedupeKey,
            canonicalIdentity: {
                provider: 'GOOGLE_MAPS',
                canonicalCid: submission.canonicalCid ?? null,
                placeName: submission.placeName ?? null,
                googlePlaceId: submission.googlePlaceId ?? null,
                placeHexId: submission.placeHexId ?? null,
            },
            recommendation: {
                code: submission.recommendationCode ?? null,
                message: submission.recommendationMessage ?? null,
            },
            linkedSourceId: sameRestaurantSource?.id ?? submission.linkedSourceId ?? null,
            queueState,
            priority,
            schedulingLane,
            otherRestaurantCount,
            claim,
            submittedAt: submission.submittedAt,
            lastResolvedAt: submission.lastResolvedAt ?? null,
            nextAction: buildSourceSubmissionNextAction({
                queueState,
            }),
        }
    })

    const actionableItems = workItems.filter(
        (item) => item.queueState !== SOURCE_SUBMISSION_QUEUE_STATE.ALREADY_LINKED,
    )
    const groupsByKey = new Map()

    for (const item of actionableItems) {
        const groupKey = item.dedupeKey
        const existingGroup = groupsByKey.get(groupKey)

        if (!existingGroup) {
            groupsByKey.set(groupKey, {
                groupKey,
                queueState: item.queueState,
                priority: item.priority,
                schedulingLane: item.schedulingLane,
                claim: item.claim,
                nextAction: item.nextAction,
                canonicalIdentity: item.canonicalIdentity,
                oldestSubmittedAt: item.submittedAt,
                restaurants: [mapSourceSubmissionRestaurantItem(item)],
            })
            continue
        }

        existingGroup.restaurants.push(mapSourceSubmissionRestaurantItem(item))
        if (getQueuePriorityScore(item.priority) > getQueuePriorityScore(existingGroup.priority)) {
            existingGroup.priority = item.priority
            existingGroup.queueState = item.queueState
            existingGroup.nextAction = item.nextAction
        }
        if (getSchedulingLaneScore(item.schedulingLane) > getSchedulingLaneScore(existingGroup.schedulingLane)) {
            existingGroup.schedulingLane = item.schedulingLane
        }
        if (item.claim?.isActive && !existingGroup.claim?.isActive) {
            existingGroup.claim = item.claim
        }
        if (item.submittedAt < existingGroup.oldestSubmittedAt) {
            existingGroup.oldestSubmittedAt = item.submittedAt
        }
    }

    const groups = [...groupsByKey.values()]
        .map((group) => ({
            ...group,
            restaurantCount: group.restaurants.length,
        }))
        .sort((left, right) => {
            const leftClaimActive = left.claim?.isActive === true
            const rightClaimActive = right.claim?.isActive === true
            if (leftClaimActive !== rightClaimActive) {
                return Number(leftClaimActive) - Number(rightClaimActive)
            }

            const priorityDelta =
                getQueuePriorityScore(right.priority) - getQueuePriorityScore(left.priority)
            if (priorityDelta !== 0) {
                return priorityDelta
            }

            return new Date(left.oldestSubmittedAt).getTime() - new Date(right.oldestSubmittedAt).getTime()
        })

    return {
        summary: {
            totalSubmissions: submissions.length,
            actionableCount: actionableItems.length,
            dedupedGroupCount: groups.length,
            unresolvedCount: actionableItems.filter(
                (item) => item.queueState === SOURCE_SUBMISSION_QUEUE_STATE.RESOLVE_IDENTITY,
            ).length,
            reuseSharedIdentityCount: actionableItems.filter(
                (item) => item.queueState === SOURCE_SUBMISSION_QUEUE_STATE.REUSE_SHARED_IDENTITY,
            ).length,
            createSourceCount: actionableItems.filter(
                (item) => item.queueState === SOURCE_SUBMISSION_QUEUE_STATE.CREATE_SOURCE,
            ).length,
            priorityLaneCount: actionableItems.filter(
                (item) =>
                    item.schedulingLane ===
                    restaurantPrivate.SOURCE_SUBMISSION_SCHEDULING_LANE.PRIORITY,
            ).length,
            claimedGroupCount: groups.filter((group) => group.claim?.isActive).length,
            availableGroupCount: groups.filter((group) => !group.claim?.isActive).length,
            linkedButStaleCount: workItems.filter(
                (item) => item.queueState === SOURCE_SUBMISSION_QUEUE_STATE.ALREADY_LINKED,
            ).length,
        },
        groups,
        restaurantItems: new Map(actionableItems.map((item) => [item.restaurantId, item])),
    }
}

function buildAdminNextActions({ datasetStatus, sourceStats, latestRun, sourceSubmissionWorkItem = null }) {
    const actions = []

    if (sourceSubmissionWorkItem) {
        actions.push(sourceSubmissionWorkItem.nextAction)
    }

    if (!datasetStatus.lastPublishedAt) {
        actions.push('Create the first draft intake batch or sync a crawl source before merchant dashboards go live.')
    }

    if (sourceStats.totalCount === 0 && !sourceSubmissionWorkItem) {
        actions.push('Register at least one crawl source if this restaurant should ingest Google Maps evidence.')
    }

    if (datasetStatus.pendingBatchCount > 0 && datasetStatus.approvedItemCount === 0) {
        actions.push('Review pending intake items and approve valid evidence before publish.')
    }

    if (datasetStatus.readyBatchCount > 0) {
        actions.push('Publish the ready batch to refresh the canonical merchant dataset.')
    }

    if (latestRun && ['PARTIAL', 'COMPLETED'].includes(latestRun.status) && datasetStatus.pendingBatchCount === 0) {
        actions.push('Materialize the latest crawl run into a draft batch so the intake workflow can continue.')
    }

    return actions
}

async function listAdminRestaurants({ userId }) {
    await ensureAdminAccess(userId)

    const [restaurants, openBatchCounts, activeSourceCounts] = await Promise.all([
        prisma.restaurant.findMany({
            include: {
                entitlement: true,
                insight: true,
                _count: {
                    select: {
                        reviews: true,
                        users: true,
                    },
                },
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.reviewIntakeBatch.groupBy({
            by: ['restaurantId'],
            where: {
                status: {
                    in: OPEN_BATCH_STATUSES,
                },
            },
            _count: {
                _all: true,
            },
        }),
        prisma.reviewCrawlSource.groupBy({
            by: ['restaurantId'],
            where: {
                status: 'ACTIVE',
            },
            _count: {
                _all: true,
            },
        }),
    ])

    const openBatchCountByRestaurantId = new Map(
        openBatchCounts.map((row) => [row.restaurantId, row._count._all]),
    )
    const activeSourceCountByRestaurantId = new Map(
        activeSourceCounts.map((row) => [row.restaurantId, row._count._all]),
    )

    return restaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        googleMapUrl: restaurant.googleMapUrl,
        totalReviews: restaurant._count.reviews,
        memberCount: restaurant._count.users,
        entitlement: mapRestaurantEntitlement({
            id: restaurant.entitlement?.id ?? null,
            restaurantId: restaurant.id,
            planTier: restaurant.entitlement?.planTier ?? null,
            createdAt: restaurant.entitlement?.createdAt ?? null,
            updatedAt: restaurant.entitlement?.updatedAt ?? null,
        }),
        pendingBatchCount: openBatchCountByRestaurantId.get(restaurant.id) ?? 0,
        activeSourceCount: activeSourceCountByRestaurantId.get(restaurant.id) ?? 0,
        insightSummary: buildInsightSummary(restaurant.insight),
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
    }))
}

async function listAdminSourceSubmissions({ userId }) {
    await ensureAdminAccess(userId)

    const queue = await fetchSourceSubmissionQueue()

    return {
        summary: queue.summary,
        groups: queue.groups,
    }
}

async function getAdminRestaurantDetail({ userId, restaurantId }) {
    await ensureAdminAccess(userId)

    const restaurantAccess = await ensureRestaurantExists({
        restaurantId,
        restaurantInclude: {
            entitlement: true,
            insight: true,
            _count: {
                select: {
                    reviews: true,
                    users: true,
                },
            },
        },
    })

    const [intakeSummary, openBatches, sourceStats, latestRun, sourceSubmissionQueue] = await Promise.all([
        restaurantPrivate.fetchIntakeSummary(restaurantId),
        prisma.reviewIntakeBatch.findMany({
            where: {
                restaurantId,
                status: {
                    in: OPEN_BATCH_STATUSES,
                },
            },
            include: {
                items: {
                    select: {
                        approvalStatus: true,
                    },
                },
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: 10,
        }),
        Promise.all([
            prisma.reviewCrawlSource.count({ where: { restaurantId } }),
            prisma.reviewCrawlSource.count({ where: { restaurantId, status: 'ACTIVE' } }),
            prisma.reviewCrawlSource.count({ where: { restaurantId, status: 'DISABLED' } }),
        ]).then(([totalCount, activeCount, disabledCount]) => ({
            totalCount,
            activeCount,
            disabledCount,
        })),
        prisma.reviewCrawlRun.findFirst({
            where: {
                restaurantId,
            },
            orderBy: [{ createdAt: 'desc' }],
        }),
        fetchSourceSubmissionQueue({ restaurantId }),
    ])

    const datasetStatus = restaurantPrivate.buildDatasetStatus(intakeSummary)
    const sourceSubmissionWorkItem = sourceSubmissionQueue.restaurantItems.get(restaurantId) ?? null

    return {
        restaurant: {
            id: restaurantAccess.restaurant.id,
            name: restaurantAccess.restaurant.name,
            slug: restaurantAccess.restaurant.slug,
            address: restaurantAccess.restaurant.address,
            googleMapUrl: restaurantAccess.restaurant.googleMapUrl,
            totalReviews: restaurantAccess.restaurantWithRelations._count.reviews,
            memberCount: restaurantAccess.restaurantWithRelations._count.users,
            entitlement: mapRestaurantEntitlement({
                id: restaurantAccess.restaurantWithRelations.entitlement?.id ?? null,
                restaurantId,
                planTier:
                    restaurantAccess.restaurantWithRelations.entitlement?.planTier ??
                    null,
                createdAt:
                    restaurantAccess.restaurantWithRelations.entitlement?.createdAt ??
                    null,
                updatedAt:
                    restaurantAccess.restaurantWithRelations.entitlement?.updatedAt ??
                    null,
            }),
            createdAt: restaurantAccess.restaurant.createdAt,
            updatedAt: restaurantAccess.restaurant.updatedAt,
        },
        userFlow: {
            datasetStatus,
            insightSummary: buildInsightSummary(restaurantAccess.restaurantWithRelations.insight),
        },
        adminFlow: {
            sourceStats,
            latestRun: mapLatestRun(latestRun),
            openBatches: openBatches.map((batch) => mapBatchSummary(batch)),
            sourceSubmissionQueue: {
                summary: sourceSubmissionQueue.summary,
                item: sourceSubmissionWorkItem,
            },
            nextActions: buildAdminNextActions({
                datasetStatus,
                sourceStats,
                latestRun,
                sourceSubmissionWorkItem,
            }),
        },
    }
}

async function updateRestaurantEntitlement({ userId, restaurantId, input = {} }) {
    await ensureAdminAccess(userId)

    const restaurantAccess = await ensureRestaurantExists({
        restaurantId,
        restaurantInclude: {
            entitlement: true,
        },
    })

    const previousEntitlement = mapRestaurantEntitlement({
        id: restaurantAccess.restaurantWithRelations.entitlement?.id ?? null,
        restaurantId,
        planTier:
            restaurantAccess.restaurantWithRelations.entitlement?.planTier ?? null,
        createdAt:
            restaurantAccess.restaurantWithRelations.entitlement?.createdAt ?? null,
        updatedAt:
            restaurantAccess.restaurantWithRelations.entitlement?.updatedAt ?? null,
    })
    const entitlement = await upsertRestaurantEntitlement({
        restaurantId,
        planTier: input.planTier,
    })

    await prisma.restaurantSourceSubmission.updateMany({
        where: {
            restaurantId,
            schedulingLaneSource:
                RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE.ENTITLEMENT_DEFAULT,
        },
        data: {
            schedulingLane: entitlement.effectivePolicy.sourceSubmissionLane,
        },
    })

    await appendAuditEvent({
        action: 'ADMIN_RESTAURANT_ENTITLEMENT_UPDATED',
        resourceType: 'restaurant',
        resourceId: restaurantId,
        restaurantId,
        actorUserId: userId,
        summary: `Admin set ${restaurantAccess.restaurant.name} to the ${entitlement.planTier.toLowerCase()} plan tier.`,
        metadata: {
            previous: previousEntitlement,
            current: entitlement,
        },
    })

    return {
        restaurantId,
        entitlement,
    }
}

module.exports = {
    claimNextSourceSubmissionGroup,
    createSourceFromSubmission,
    fetchSourceSubmissionQueue,
    getAdminRestaurantDetail,
    updateRestaurantEntitlement,
    resolveAdminSourceSubmission,
    listAdminSourceSubmissions,
    listAdminRestaurants,
    updateSourceSubmissionSchedulingLane,
    __private: {
        SOURCE_SUBMISSION_QUEUE_PRIORITY,
        SOURCE_SUBMISSION_QUEUE_STATE,
        buildSourceSubmissionNextAction,
        deriveSourceSubmissionPriority,
        isSourceSubmissionClaimActive,
        mapSourceSubmissionClaim,
        mapPersistedSourceSubmission,
    },
}
