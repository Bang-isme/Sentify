const crypto = require('node:crypto')

const { getRestaurantAccess } = require('./restaurant-access.service')
const { buildInsightSummary } = require('./insight.service')
const { appendAuditEvent } = require('./audit-event.service')
const { badRequest } = require('../lib/app-error')
const {
    ensureRestaurantEntitlement,
    getEffectiveRestaurantEntitlement,
    mapRestaurantEntitlement,
    RESTAURANT_SOURCE_SUBMISSION_SCHEDULING_LANE_SOURCE,
} = require('./restaurant-entitlement.service')
const googleMapsProvider = require('../modules/review-crawl/google-maps.service')
const prisma = require('../lib/prisma')

const SOURCE_SUBMISSION_STATUS = Object.freeze({
    UNCONFIGURED: 'UNCONFIGURED',
    SUBMITTED: 'SUBMITTED',
    SOURCE_READY: 'SOURCE_READY',
    QUEUED: 'QUEUED',
    CRAWLING: 'CRAWLING',
    REVIEWING: 'REVIEWING',
    READY_TO_PUBLISH: 'READY_TO_PUBLISH',
    LIVE: 'LIVE',
    NEEDS_ATTENTION: 'NEEDS_ATTENTION',
})

const SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION = Object.freeze({
    ALREADY_CONNECTED: 'ALREADY_CONNECTED',
    REUSE_SHARED_IDENTITY: 'REUSE_SHARED_IDENTITY',
    SUBMIT_FOR_ADMIN_SYNC: 'SUBMIT_FOR_ADMIN_SYNC',
})

const PERSISTED_SOURCE_SUBMISSION_STATUS = Object.freeze({
    PENDING_IDENTITY_RESOLUTION: 'PENDING_IDENTITY_RESOLUTION',
    READY_FOR_SOURCE_LINK: 'READY_FOR_SOURCE_LINK',
    LINKED_TO_SOURCE: 'LINKED_TO_SOURCE',
})

const SOURCE_SUBMISSION_SCHEDULING_LANE = Object.freeze({
    STANDARD: 'STANDARD',
    PRIORITY: 'PRIORITY',
})

const SOURCE_SUBMISSION_HISTORY_EVENT = Object.freeze({
    URL_SUBMITTED: 'URL_SUBMITTED',
    URL_CLEARED: 'URL_CLEARED',
    PLACE_CONFIRMED: 'PLACE_CONFIRMED',
    SOURCE_CONNECTED: 'SOURCE_CONNECTED',
    SYNC_QUEUED: 'SYNC_QUEUED',
    SYNC_IN_PROGRESS: 'SYNC_IN_PROGRESS',
    SYNC_COMPLETED: 'SYNC_COMPLETED',
    SYNC_FAILED: 'SYNC_FAILED',
    EVIDENCE_IN_REVIEW: 'EVIDENCE_IN_REVIEW',
    READY_TO_PUBLISH: 'READY_TO_PUBLISH',
    LIVE: 'LIVE',
    ATTENTION_REQUIRED: 'ATTENTION_REQUIRED',
})

const SOURCE_SUBMISSION_TIMELINE_STEP_ORDER = [
    SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED,
    SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED,
    SOURCE_SUBMISSION_HISTORY_EVENT.SOURCE_CONNECTED,
    SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_QUEUED,
    SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_IN_PROGRESS,
    SOURCE_SUBMISSION_HISTORY_EVENT.EVIDENCE_IN_REVIEW,
    SOURCE_SUBMISSION_HISTORY_EVENT.READY_TO_PUBLISH,
    SOURCE_SUBMISSION_HISTORY_EVENT.LIVE,
]

const SOURCE_SUBMISSION_HISTORY_EVENT_ORDER = [
    ...SOURCE_SUBMISSION_TIMELINE_STEP_ORDER,
    SOURCE_SUBMISSION_HISTORY_EVENT.URL_CLEARED,
    SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_COMPLETED,
    SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_FAILED,
    SOURCE_SUBMISSION_HISTORY_EVENT.ATTENTION_REQUIRED,
]

const SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS = [
    'MERCHANT_SOURCE_SUBMITTED',
    'MERCHANT_SOURCE_UPDATED',
    'MERCHANT_SOURCE_CLEARED',
    'ADMIN_SOURCE_SUBMISSION_RESOLVED',
    'ADMIN_SOURCE_SUBMISSION_LINKED',
    'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED',
    'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
    'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
]

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

function mapSourceSubmissionHistoryActorType(actor) {
    if (!actor) {
        return 'SYSTEM'
    }

    return actor.role === 'ADMIN' ? 'ADMIN' : 'USER'
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

function mapRestaurantEntitlementResponse(restaurantId, entitlement = null) {
    return mapRestaurantEntitlement({
        id: entitlement?.id ?? null,
        restaurantId,
        planTier: entitlement?.planTier ?? null,
        createdAt: entitlement?.createdAt ?? null,
        updatedAt: entitlement?.updatedAt ?? null,
    })
}

function buildSourceSubmissionAttemptKey(snapshot, fallbackValue = null) {
    if (!snapshot?.submittedAt && !snapshot?.inputUrl) {
        return fallbackValue
    }

    const submittedAt =
        snapshot?.submittedAt instanceof Date
            ? snapshot.submittedAt.toISOString()
            : snapshot?.submittedAt ?? 'unknown-submitted-at'
    const inputUrl = snapshot?.inputUrl ?? 'unknown-input-url'

    return `${submittedAt}::${inputUrl}`
}

function deriveSourceSubmissionTimelineCodeFromAuditAction(action) {
    if (['MERCHANT_SOURCE_SUBMITTED', 'MERCHANT_SOURCE_UPDATED'].includes(action)) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED
    }

    if (action === 'MERCHANT_SOURCE_CLEARED') {
        return SOURCE_SUBMISSION_HISTORY_EVENT.URL_CLEARED
    }

    if (action === 'ADMIN_SOURCE_SUBMISSION_RESOLVED') {
        return SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED
    }

    if (
        [
            'ADMIN_SOURCE_SUBMISSION_LINKED',
            'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED',
            'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
        ].includes(action)
    ) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.SOURCE_CONNECTED
    }

    if (action === 'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED') {
        return SOURCE_SUBMISSION_HISTORY_EVENT.ATTENTION_REQUIRED
    }

    return null
}

function extractSourceSubmissionAuditSnapshot(event) {
    const metadata = event?.metadataJson ?? {}
    const rawSnapshot =
        metadata.sourceSubmissionSnapshot ??
        metadata.current ??
        metadata.previous ??
        null

    if (rawSnapshot) {
        return buildSourceSubmissionAuditSnapshot(rawSnapshot)
    }

    const fallbackInputUrl =
        metadata.nextGoogleMapUrl ?? metadata.previousGoogleMapUrl ?? null

    if (!fallbackInputUrl) {
        return null
    }

    return buildSourceSubmissionAuditSnapshot({
        inputUrl: fallbackInputUrl,
    })
}

function buildSourceSubmissionHistoryEvent({
    code,
    title,
    description,
    occurredAt,
    actorType = 'SYSTEM',
    source,
    severity = 'INFO',
}) {
    if (!occurredAt) {
        return null
    }

    return {
        code,
        title,
        description,
        occurredAt,
        actorType,
        source,
        severity,
    }
}

function findFirstAuditEvent(auditEvents, actions) {
    return auditEvents.find((event) => actions.includes(event.action)) ?? null
}

function sortSourceSubmissionHistoryEvents(events) {
    return [...events]
        .filter(Boolean)
        .sort((left, right) => {
            const timeDelta =
                new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()

            if (timeDelta !== 0) {
                return timeDelta
            }

            const leftIndex = SOURCE_SUBMISSION_HISTORY_EVENT_ORDER.indexOf(left.code)
            const rightIndex = SOURCE_SUBMISSION_HISTORY_EVENT_ORDER.indexOf(right.code)

            if (leftIndex !== -1 && rightIndex !== -1 && leftIndex !== rightIndex) {
                return leftIndex - rightIndex
            }

            return left.code.localeCompare(right.code)
        })
}

function buildSourceSubmissionHistory({
    googleMapUrl,
    sourceSubmission = null,
    submissionRecord = null,
    source = null,
    latestRun = null,
    openBatch = null,
    publishedBatch = null,
    latestPublishedBatch = null,
    auditEvents = [],
}) {
    const events = []
    const submittedAuditEvent = findFirstAuditEvent(auditEvents, [
        'MERCHANT_SOURCE_SUBMITTED',
        'MERCHANT_SOURCE_UPDATED',
    ])
    const resolvedAuditEvent = findFirstAuditEvent(auditEvents, [
        'ADMIN_SOURCE_SUBMISSION_RESOLVED',
    ])
    const linkedAuditEvent = findFirstAuditEvent(auditEvents, [
        'ADMIN_SOURCE_SUBMISSION_LINKED',
        'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED',
        'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
    ])
    const failedBootstrapAuditEvent = findFirstAuditEvent(auditEvents, [
        'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
        'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
    ])
    const publishedInsightAt =
        publishedBatch?.publishedAt ??
        (sourceSubmission?.publishedFromSource &&
        latestPublishedBatch?.sourceType === 'GOOGLE_MAPS_CRAWL'
            ? latestPublishedBatch.publishedAt
            : null)

    if (submissionRecord?.submittedAt || submittedAuditEvent?.createdAt) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED,
                title: 'Google Maps URL submitted',
                description:
                    'Your Google Maps URL was saved and entered the ingestion pipeline.',
                occurredAt: submittedAuditEvent?.createdAt ?? submissionRecord?.submittedAt,
                actorType: submittedAuditEvent
                    ? mapSourceSubmissionHistoryActorType(submittedAuditEvent.actor)
                    : 'USER',
                source: submittedAuditEvent ? 'AUDIT' : 'SUBMISSION',
                severity: 'INFO',
            }),
        )
    } else if (googleMapUrl) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED,
                title: 'Google Maps URL submitted',
                description:
                    'A Google Maps URL is currently configured for this restaurant.',
                occurredAt: source?.createdAt ?? latestRun?.queuedAt ?? openBatch?.createdAt ?? publishedBatch?.publishedAt ?? null,
                actorType: 'USER',
                source: 'STATE',
                severity: 'INFO',
            }),
        )
    }

    if (submissionRecord?.canonicalCid && submissionRecord?.lastResolvedAt) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED,
                title: 'Place identity confirmed',
                description:
                    'The submitted Google Maps URL was matched to a specific place identity.',
                occurredAt: resolvedAuditEvent?.createdAt ?? submissionRecord.lastResolvedAt,
                actorType: resolvedAuditEvent
                    ? mapSourceSubmissionHistoryActorType(resolvedAuditEvent.actor)
                    : 'SYSTEM',
                source: resolvedAuditEvent ? 'AUDIT' : 'SUBMISSION',
                severity: 'INFO',
            }),
        )
    }

    if (source) {
        const linkAction = linkedAuditEvent?.action ?? null
        const linkDescription =
            linkAction === 'ADMIN_SOURCE_SUBMISSION_LINKED'
                ? 'An admin linked your place to a crawl source.'
                : linkAction === 'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED'
                  ? 'The system linked your place to a crawl source automatically.'
                  : linkAction === 'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR'
                    ? 'The system linked your place to a crawl source, but the first queue attempt needs attention.'
                    : 'Your place is connected to a crawl source.'

        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.SOURCE_CONNECTED,
                title: 'Source connected',
                description: linkDescription,
                occurredAt: linkedAuditEvent?.createdAt ?? source.createdAt ?? null,
                actorType: linkedAuditEvent
                    ? mapSourceSubmissionHistoryActorType(linkedAuditEvent.actor)
                    : 'SYSTEM',
                source: linkedAuditEvent ? 'AUDIT' : 'SOURCE',
                severity:
                    linkAction === 'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR'
                        ? 'ATTENTION'
                        : 'SUCCESS',
            }),
        )
    }

    if (latestRun?.queuedAt) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_QUEUED,
                title: 'Sync queued',
                description: 'The first Google Maps sync is queued to run.',
                occurredAt: latestRun.queuedAt,
                actorType: latestRun.requestedByUserId ? 'ADMIN' : 'SYSTEM',
                source: 'RUN',
                severity: 'INFO',
            }),
        )
    }

    if (latestRun?.startedAt) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_IN_PROGRESS,
                title: 'Sync started',
                description: 'The system started fetching review evidence from Google Maps.',
                occurredAt: latestRun.startedAt,
                actorType: 'SYSTEM',
                source: 'RUN',
                severity: 'INFO',
            }),
        )
    }

    if (latestRun?.finishedAt) {
        const syncSucceeded = ['COMPLETED', 'PARTIAL'].includes(latestRun.status)
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: syncSucceeded
                    ? SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_COMPLETED
                    : SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_FAILED,
                title: syncSucceeded ? 'Sync finished' : 'Sync needs attention',
                description: syncSucceeded
                    ? 'The latest sync finished and moved valid review evidence forward.'
                    : 'The latest sync did not finish cleanly and needs admin attention.',
                occurredAt: latestRun.finishedAt,
                actorType: 'SYSTEM',
                source: 'RUN',
                severity: syncSucceeded ? 'SUCCESS' : 'ATTENTION',
            }),
        )
    }

    if (openBatch?.createdAt) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.EVIDENCE_IN_REVIEW,
                title: 'Evidence in review',
                description:
                    'Fresh Google Maps evidence has been staged for admin review.',
                occurredAt: openBatch.createdAt,
                actorType: 'SYSTEM',
                source: 'BATCH',
                severity: 'INFO',
            }),
        )
    }

    if (openBatch?.status === 'READY_TO_PUBLISH') {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.READY_TO_PUBLISH,
                title: 'Ready to publish',
                description:
                    'The staged evidence has been approved and is waiting to go live.',
                occurredAt: openBatch.updatedAt ?? openBatch.createdAt,
                actorType: 'ADMIN',
                source: 'BATCH',
                severity: 'SUCCESS',
            }),
        )
    }

    if (publishedInsightAt) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.LIVE,
                title: 'Published live',
                description:
                    'Published insights from this Google Maps source are now visible in the merchant app.',
                occurredAt: publishedInsightAt,
                actorType: 'ADMIN',
                source: publishedBatch?.publishedAt ? 'PUBLISH' : 'DATASET',
                severity: 'SUCCESS',
            }),
        )
    }

    if (
        sourceSubmission?.status === SOURCE_SUBMISSION_STATUS.NEEDS_ATTENTION &&
        !events.some((event) => event.code === SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_FAILED) &&
        !events.some((event) => event.code === SOURCE_SUBMISSION_HISTORY_EVENT.ATTENTION_REQUIRED)
    ) {
        events.push(
            buildSourceSubmissionHistoryEvent({
                code: SOURCE_SUBMISSION_HISTORY_EVENT.ATTENTION_REQUIRED,
                title: 'Attention required',
                description:
                    sourceSubmission.message ??
                    'The current source state needs admin attention before new data can move forward.',
                occurredAt:
                    failedBootstrapAuditEvent?.createdAt ??
                    latestRun?.finishedAt ??
                    source?.updatedAt ??
                    source?.lastSuccessfulRunAt ??
                    submissionRecord?.lastResolvedAt ??
                    submissionRecord?.submittedAt ??
                    null,
                actorType: failedBootstrapAuditEvent
                    ? mapSourceSubmissionHistoryActorType(failedBootstrapAuditEvent.actor)
                    : 'SYSTEM',
                source: failedBootstrapAuditEvent ? 'AUDIT' : 'STATE',
                severity: 'ATTENTION',
            }),
        )
    }

    const sortedEvents = sortSourceSubmissionHistoryEvents(events)

    return {
        currentStatus: sourceSubmission?.status ?? SOURCE_SUBMISSION_STATUS.UNCONFIGURED,
        currentMessage:
            sourceSubmission?.message ?? 'Google Maps URL has not been submitted yet.',
        needsUserAction: sourceSubmission?.needsUserAction ?? !googleMapUrl,
        needsAdminAction: sourceSubmission?.needsAdminAction ?? false,
        latestEventAt:
            sortedEvents.length > 0
                ? sortedEvents[sortedEvents.length - 1].occurredAt
                : null,
        events: sortedEvents,
    }
}

function deriveCurrentTimelineStepCode({
    sourceSubmission = null,
    submissionRecord = null,
    source = null,
    latestRun = null,
}) {
    const currentStatus =
        sourceSubmission?.status ?? SOURCE_SUBMISSION_STATUS.UNCONFIGURED

    if (currentStatus === SOURCE_SUBMISSION_STATUS.UNCONFIGURED) {
        return null
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.SUBMITTED) {
        return submissionRecord?.canonicalCid
            ? SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED
            : SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.SOURCE_READY) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.SOURCE_CONNECTED
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.QUEUED) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_QUEUED
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.CRAWLING) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_IN_PROGRESS
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.REVIEWING) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.EVIDENCE_IN_REVIEW
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.READY_TO_PUBLISH) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.READY_TO_PUBLISH
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.LIVE) {
        return SOURCE_SUBMISSION_HISTORY_EVENT.LIVE
    }

    if (currentStatus === SOURCE_SUBMISSION_STATUS.NEEDS_ATTENTION) {
        if (latestRun && ['FAILED', 'CANCELLED'].includes(latestRun.status)) {
            return SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_IN_PROGRESS
        }

        if (source) {
            return SOURCE_SUBMISSION_HISTORY_EVENT.SOURCE_CONNECTED
        }

        return submissionRecord?.canonicalCid
            ? SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED
            : SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED
    }

    return null
}

function buildSourceSubmissionTimelineSteps({
    currentStepCode,
    events,
}) {
    const eventByCode = new Map(events.map((event) => [event.code, event]))
    const currentIndex =
        currentStepCode === null
            ? -1
            : SOURCE_SUBMISSION_TIMELINE_STEP_ORDER.indexOf(currentStepCode)
    const labels = {
        URL_SUBMITTED: 'URL submitted',
        PLACE_CONFIRMED: 'Place confirmed',
        SOURCE_CONNECTED: 'Source linked',
        SYNC_QUEUED: 'Sync queued',
        SYNC_IN_PROGRESS: 'Sync in progress',
        EVIDENCE_IN_REVIEW: 'Evidence in review',
        READY_TO_PUBLISH: 'Ready to publish',
        LIVE: 'Live',
    }
    const messages = {
        URL_SUBMITTED: 'Google Maps URL was saved.',
        PLACE_CONFIRMED: 'Canonical Google Maps place was identified.',
        SOURCE_CONNECTED: 'A crawl source was linked to this restaurant.',
        SYNC_QUEUED: 'A sync run is queued.',
        SYNC_IN_PROGRESS: 'Reviews are being fetched.',
        EVIDENCE_IN_REVIEW: 'New evidence is waiting for admin review.',
        READY_TO_PUBLISH: 'Approved evidence is waiting to be published.',
        LIVE: 'Published restaurant intelligence is live.',
    }

    return SOURCE_SUBMISSION_TIMELINE_STEP_ORDER.map((code, index) => {
        const matchingEvent = eventByCode.get(code) ?? null
        let state = 'pending'

        if (currentIndex >= 0 && index < currentIndex) {
            state = 'completed'
        } else if (currentIndex >= 0 && index === currentIndex) {
            state = 'current'
        }

        if (matchingEvent && currentIndex === -1) {
            state = 'completed'
        }

        if (matchingEvent && state === 'pending') {
            state = 'completed'
        }

        return {
            code,
            label: labels[code],
            state,
            at: matchingEvent?.occurredAt ?? null,
            source: matchingEvent?.source ?? null,
            message: matchingEvent?.description ?? messages[code],
        }
    })
}

function buildSourceSubmissionTimeline({
    sourceSubmission = null,
    submissionRecord = null,
    source = null,
    latestRun = null,
    history,
}) {
    const currentStepCode = deriveCurrentTimelineStepCode({
        sourceSubmission,
        submissionRecord,
        source,
        latestRun,
    })

    return {
        currentStage:
            sourceSubmission?.status ?? SOURCE_SUBMISSION_STATUS.UNCONFIGURED,
        currentStepCode,
        isLive: Boolean(sourceSubmission?.publishedFromSource),
        latestEventAt: history.latestEventAt,
        steps: buildSourceSubmissionTimelineSteps({
            currentStepCode,
            events: history.events,
        }),
        events: history.events,
    }
}

function buildDatasetStatus({ latestPublishedBatch, openBatches }) {
    const sourcePolicy = latestPublishedBatch ? 'ADMIN_CURATED' : 'UNCONFIGURED'
    const openBatchSummary = (openBatches || []).reduce(
        (summary, batch) => {
            summary.pendingBatchCount += 1

            for (const item of batch.items || []) {
                if (item.approvalStatus === 'APPROVED') {
                    summary.approvedItemCount += 1
                } else if (item.approvalStatus === 'REJECTED') {
                    summary.rejectedItemCount += 1
                } else {
                    summary.pendingItemCount += 1
                }
            }

            if (batch.status === 'READY_TO_PUBLISH') {
                summary.readyBatchCount += 1
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

    return {
        sourcePolicy,
        lastPublishedAt: latestPublishedBatch?.publishedAt ?? null,
        lastPublishedSourceType: latestPublishedBatch?.sourceType ?? null,
        pendingBatchCount: openBatchSummary.pendingBatchCount,
        readyBatchCount: openBatchSummary.readyBatchCount,
        pendingItemCount: openBatchSummary.pendingItemCount,
        approvedItemCount: openBatchSummary.approvedItemCount,
        rejectedItemCount: openBatchSummary.rejectedItemCount,
    }
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

function buildSourceSubmissionPayload({
    status,
    googleMapUrl,
    message,
    submissionRecord = null,
    source = null,
    latestRun = null,
    openBatch = null,
    publishedBatch = null,
    publishedFromSource = Boolean(publishedBatch),
    needsUserAction = false,
    needsAdminAction = false,
    timeline = null,
}) {
    const derivedSubmissionStatus =
        submissionRecord && source
            ? PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE
            : submissionRecord?.status ?? null
    const derivedLinkedSourceId = submissionRecord?.linkedSourceId ?? source?.id ?? null

    return {
        status,
        currentUrl: googleMapUrl ?? null,
        message,
        needsUserAction,
        needsAdminAction,
        publishedFromSource,
        submission: submissionRecord
            ? {
                  id: submissionRecord.id,
                  status: derivedSubmissionStatus,
                  inputUrl: submissionRecord.inputUrl,
                  normalizedUrl: submissionRecord.normalizedUrl ?? null,
                  canonicalCid: submissionRecord.canonicalCid ?? null,
                  placeName: submissionRecord.placeName ?? null,
                  googlePlaceId: submissionRecord.googlePlaceId ?? null,
                  placeHexId: submissionRecord.placeHexId ?? null,
                  recommendationCode: submissionRecord.recommendationCode ?? null,
                  recommendationMessage: submissionRecord.recommendationMessage ?? null,
                  schedulingLane: submissionRecord.schedulingLane ?? null,
                  schedulingLaneSource:
                      submissionRecord.schedulingLaneSource ?? null,
                  linkedSourceId: derivedLinkedSourceId,
                  submittedAt: submissionRecord.submittedAt ?? null,
                  lastResolvedAt: submissionRecord.lastResolvedAt ?? null,
              }
            : null,
        source: source
            ? {
                  id: source.id,
                  provider: source.provider,
                  status: source.status,
                  syncEnabled: source.syncEnabled,
                  canonicalCid: source.canonicalCid,
                  placeName: source.placeName ?? null,
                  lastSyncedAt: source.lastSyncedAt ?? null,
                  lastSuccessfulRunAt: source.lastSuccessfulRunAt ?? null,
              }
            : null,
        latestRun: latestRun
            ? {
                  id: latestRun.id,
                  status: latestRun.status,
                  queuedAt: latestRun.queuedAt ?? null,
                  startedAt: latestRun.startedAt ?? null,
                  finishedAt: latestRun.finishedAt ?? null,
                  validCount: latestRun.validCount ?? 0,
                  warningCount: latestRun.warningCount ?? 0,
                  errorCode: latestRun.errorCode ?? null,
                  errorMessage: latestRun.errorMessage ?? null,
              }
            : null,
        openBatch: openBatch
            ? {
                  id: openBatch.id,
                  status: openBatch.status,
                  title: openBatch.title ?? null,
                  updatedAt: openBatch.updatedAt ?? null,
                  createdAt: openBatch.createdAt ?? null,
              }
            : null,
        latestPublishedBatch: publishedBatch
            ? {
                  id: publishedBatch.id,
                  status: publishedBatch.status,
                  title: publishedBatch.title ?? null,
                  publishedAt: publishedBatch.publishedAt ?? null,
              }
            : null,
        timeline,
    }
}

function buildInitialSourceSubmission(googleMapUrl, submissionRecord = null) {
    if (!googleMapUrl) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.UNCONFIGURED,
            googleMapUrl,
            message: 'Google Maps URL has not been submitted yet.',
            submissionRecord,
            needsUserAction: true,
        })
    }

    if (submissionRecord?.status === PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.SUBMITTED,
            googleMapUrl,
            message:
                'Google Maps place identity is confirmed and is waiting for admin to create the crawl source.',
            submissionRecord,
            needsAdminAction: true,
        })
    }

    if (submissionRecord?.status === PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.NEEDS_ATTENTION,
            googleMapUrl,
            message:
                'Google Maps place was linked before, but the crawl source is missing and needs admin attention.',
            submissionRecord,
            needsAdminAction: true,
        })
    }

    return buildSourceSubmissionPayload({
        status: SOURCE_SUBMISSION_STATUS.SUBMITTED,
        googleMapUrl,
        message: 'Google Maps URL was saved and is waiting for admin sync.',
        submissionRecord,
        needsAdminAction: true,
    })
}

function buildSourceSubmissionFromState({
    googleMapUrl,
    source,
    latestRun,
    openBatch,
    publishedBatch,
    latestPublishedBatch = null,
    sourceSubmissionRecord = null,
}) {
    if (!googleMapUrl) {
        return buildInitialSourceSubmission(null, sourceSubmissionRecord)
    }

    if (!source) {
        return buildInitialSourceSubmission(googleMapUrl, sourceSubmissionRecord)
    }

    const sourcePaused = source.status === 'DISABLED' || source.syncEnabled === false
    const publishedFromSource = Boolean(
        publishedBatch || (source && latestPublishedBatch?.sourceType === 'GOOGLE_MAPS_CRAWL'),
    )

    if (latestRun?.status === 'QUEUED') {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.QUEUED,
            googleMapUrl,
            message: 'Your Google Maps source is queued for sync.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            publishedFromSource,
        })
    }

    if (latestRun?.status === 'RUNNING') {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.CRAWLING,
            googleMapUrl,
            message: 'Your Google Maps source is currently syncing.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            publishedFromSource,
        })
    }

    if (latestRun && ['FAILED', 'CANCELLED'].includes(latestRun.status)) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.NEEDS_ATTENTION,
            googleMapUrl,
            message: 'The Google Maps source needs admin attention before new data can go live.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            publishedFromSource,
            needsAdminAction: true,
        })
    }

    if (openBatch?.status === 'READY_TO_PUBLISH') {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.READY_TO_PUBLISH,
            googleMapUrl,
            message: 'New Google Maps evidence is approved and waiting to be published.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            openBatch,
            publishedBatch,
            publishedFromSource,
            needsAdminAction: true,
        })
    }

    if (openBatch) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.REVIEWING,
            googleMapUrl,
            message: 'New Google Maps evidence is waiting for admin review.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            openBatch,
            publishedBatch,
            publishedFromSource,
            needsAdminAction: true,
        })
    }

    if (publishedBatch) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.LIVE,
            googleMapUrl,
            message: sourcePaused
                ? 'Published data is live, but future sync is paused and needs admin attention.'
                : 'Published restaurant intelligence is live from the Google Maps source.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            publishedBatch,
            publishedFromSource,
            needsAdminAction: sourcePaused,
        })
    }

    if (sourcePaused || (latestRun && ['COMPLETED', 'PARTIAL'].includes(latestRun.status))) {
        return buildSourceSubmissionPayload({
            status: SOURCE_SUBMISSION_STATUS.NEEDS_ATTENTION,
            googleMapUrl,
            message: 'The Google Maps source exists, but it still needs admin action before data can go live.',
            submissionRecord: sourceSubmissionRecord,
            source,
            latestRun,
            publishedFromSource,
            needsAdminAction: true,
        })
    }

    return buildSourceSubmissionPayload({
        status: SOURCE_SUBMISSION_STATUS.SOURCE_READY,
        googleMapUrl,
        message: 'The Google Maps source is configured and waiting for the next sync run.',
        submissionRecord: sourceSubmissionRecord,
        source,
        latestRun,
        publishedFromSource,
        needsAdminAction: true,
    })
}

async function fetchPersistedSourceSubmissionRecord(restaurantId) {
    return prisma.restaurantSourceSubmission.findUnique({
        where: {
            restaurantId,
        },
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
        sameInputUrlAsExisting && persistedStatus !== PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE
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
                _count: {
                    select: { items: true },
                },
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

    // Merge the batch status counts and approval counts into the expected format
    const mergedBatches = openBatches.map((batch) => ({
        status: batch.status,
        items: [],
    }))

    // Build a mock items array from approvalCounts for buildDatasetStatus compatibility
    const mockItems = []
    for (const group of approvalCounts) {
        for (let i = 0; i < group._count._all; i++) {
            mockItems.push({ approvalStatus: group.approvalStatus })
        }
    }

    // Attach items to the first batch for counting (buildDatasetStatus iterates all batch items)
    if (mergedBatches.length > 0) {
        mergedBatches[0].items = mockItems
    }

    return { latestPublishedBatch, openBatches: mergedBatches }
}

async function fetchSourceSubmissionState(restaurantId, googleMapUrl, sourceSubmissionRecord = null) {
    if (!googleMapUrl) {
        return {
            source: null,
            latestRun: null,
            openBatch: null,
            publishedBatch: null,
        }
    }

    const sourceSelect = {
        id: true,
        provider: true,
        status: true,
        inputUrl: true,
        canonicalCid: true,
        placeName: true,
        syncEnabled: true,
        lastSyncedAt: true,
        lastSuccessfulRunAt: true,
        createdAt: true,
        updatedAt: true,
    }

    let source = null

    if (sourceSubmissionRecord?.linkedSourceId) {
        source = await prisma.reviewCrawlSource.findUnique({
            where: {
                id: sourceSubmissionRecord.linkedSourceId,
            },
            select: sourceSelect,
        })
    }

    if (!source && sourceSubmissionRecord?.canonicalCid) {
        source = await prisma.reviewCrawlSource.findUnique({
            where: {
                restaurantId_provider_canonicalCid: {
                    restaurantId,
                    provider: 'GOOGLE_MAPS',
                    canonicalCid: sourceSubmissionRecord.canonicalCid,
                },
            },
            select: sourceSelect,
        })
    }

    if (!source) {
        source = await prisma.reviewCrawlSource.findFirst({
            where: {
                restaurantId,
                inputUrl: googleMapUrl,
            },
            select: sourceSelect,
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        })
    }

    if (!source) {
        return {
            source: null,
            latestRun: null,
            openBatch: null,
            publishedBatch: null,
        }
    }

    const [latestRun, sourceOpenBatch, sourcePublishedBatch] = await Promise.all([
        prisma.reviewCrawlRun.findFirst({
            where: {
                sourceId: source.id,
            },
            select: {
                id: true,
                status: true,
                requestedByUserId: true,
                intakeBatchId: true,
                queuedAt: true,
                startedAt: true,
                finishedAt: true,
                validCount: true,
                warningCount: true,
                errorCode: true,
                errorMessage: true,
            },
            orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.reviewIntakeBatch.findFirst({
            where: {
                crawlSourceId: source.id,
                status: {
                    in: ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'],
                },
            },
            select: {
                id: true,
                status: true,
                title: true,
                updatedAt: true,
                createdAt: true,
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.reviewIntakeBatch.findFirst({
            where: {
                crawlSourceId: source.id,
                status: 'PUBLISHED',
            },
            select: {
                id: true,
                status: true,
                title: true,
                publishedAt: true,
            },
            orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        }),
    ])

    const linkedBatch = latestRun?.intakeBatchId
        ? await prisma.reviewIntakeBatch.findUnique({
              where: {
                  id: latestRun.intakeBatchId,
              },
              select: {
                  id: true,
                  status: true,
                  title: true,
                  updatedAt: true,
                  createdAt: true,
                  publishedAt: true,
              },
          })
        : null

    const openBatch =
        linkedBatch && ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'].includes(linkedBatch.status)
            ? linkedBatch
            : sourceOpenBatch

    const publishedBatch =
        linkedBatch?.status === 'PUBLISHED' ? linkedBatch : sourcePublishedBatch

    return {
        source,
        latestRun,
        openBatch,
        publishedBatch,
    }
}

async function fetchSourceSubmissionAuditEvents({
    restaurantId,
    restaurantGoogleMapUrl,
    submissionRecord = null,
}) {
    if (!restaurantGoogleMapUrl && !submissionRecord) {
        return []
    }

    const auditEvents = await prisma.auditEvent.findMany({
        where: {
            restaurantId,
            action: {
                in: [
                    'MERCHANT_SOURCE_SUBMITTED',
                    'MERCHANT_SOURCE_UPDATED',
                    'ADMIN_SOURCE_SUBMISSION_RESOLVED',
                    'ADMIN_SOURCE_SUBMISSION_LINKED',
                    'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED',
                    'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
                    'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
                ],
            },
            ...(submissionRecord?.submittedAt
                ? {
                      createdAt: {
                          gte: submissionRecord.submittedAt,
                      },
                  }
                : {}),
        },
        orderBy: {
            createdAt: 'asc',
        },
        include: {
            actor: {
                select: {
                    id: true,
                    role: true,
                },
            },
        },
    })

    return auditEvents.filter((event) => {
        if (event.action.startsWith('MERCHANT_SOURCE_')) {
            return event.resourceId === restaurantId
        }

        if (
            event.action.startsWith('ADMIN_SOURCE_SUBMISSION_') ||
            event.action.startsWith('SCHEDULER_SOURCE_SUBMISSION_')
        ) {
            return submissionRecord ? event.resourceId === submissionRecord.id : true
        }

        return true
    })
}

async function fetchRestaurantSourceSubmissionHistoryAuditEvents(restaurantId) {
    return prisma.auditEvent.findMany({
        where: {
            restaurantId,
            action: {
                in: SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            actor: {
                select: {
                    id: true,
                    role: true,
                },
            },
        },
    })
}

function buildRestaurantSourceSubmissionHistory(events, currentAttemptKey = null) {
    const historyEvents = []
    const attemptMap = new Map()

    for (const event of events) {
        const snapshot = extractSourceSubmissionAuditSnapshot(event)
        const attemptKey = buildSourceSubmissionAttemptKey(
            snapshot,
            `audit:${event.id}`,
        )
        const actorType = mapSourceSubmissionHistoryActorType(event.actor)
        const timelineCode = deriveSourceSubmissionTimelineCodeFromAuditAction(
            event.action,
        )
        const mappedEvent = {
            id: event.id,
            action: event.action,
            timelineCode,
            occurredAt: event.createdAt,
            summary: event.summary,
            actorType,
            actorUserId: event.actorUserId ?? null,
            attemptKey,
            isCurrentAttempt:
                currentAttemptKey !== null && attemptKey === currentAttemptKey,
            snapshot,
        }

        historyEvents.push(mappedEvent)

        if (!attemptMap.has(attemptKey)) {
            attemptMap.set(attemptKey, {
                attemptKey,
                isCurrentAttempt:
                    currentAttemptKey !== null && attemptKey === currentAttemptKey,
                inputUrl: snapshot?.inputUrl ?? null,
                normalizedUrl: snapshot?.normalizedUrl ?? null,
                canonicalCid: snapshot?.canonicalCid ?? null,
                placeName: snapshot?.placeName ?? null,
                lastKnownPersistedStatus: snapshot?.persistedStatus ?? null,
                schedulingLane: snapshot?.schedulingLane ?? null,
                schedulingLaneSource: snapshot?.schedulingLaneSource ?? null,
                linkedSourceId: snapshot?.linkedSourceId ?? null,
                submittedAt: snapshot?.submittedAt ?? null,
                lastResolvedAt: snapshot?.lastResolvedAt ?? null,
                latestEventAt: event.createdAt,
                latestAction: event.action,
                latestTimelineCode: timelineCode,
                eventCount: 0,
            })
        }

        const attempt = attemptMap.get(attemptKey)
        attempt.eventCount += 1
    }

    return {
        attempts: [...attemptMap.values()],
        events: historyEvents,
    }
}

async function buildCurrentSourceSubmission(restaurantId, googleMapUrl, latestPublishedBatch = null) {
    if (!googleMapUrl) {
        const sourceSubmission = buildInitialSourceSubmission(null)
        const history = buildSourceSubmissionHistory({
            googleMapUrl,
            sourceSubmission,
        })

        return {
            ...sourceSubmission,
            timeline: buildSourceSubmissionTimeline({
                sourceSubmission,
                history,
            }),
        }
    }

    const submissionRecord = await fetchPersistedSourceSubmissionRecord(restaurantId)
    const sourceState = await fetchSourceSubmissionState(
        restaurantId,
        googleMapUrl,
        submissionRecord,
    )
    const sourceSubmission = buildSourceSubmissionFromState({
        googleMapUrl,
        latestPublishedBatch,
        sourceSubmissionRecord: submissionRecord,
        ...sourceState,
    })
    const auditEvents = await fetchSourceSubmissionAuditEvents({
        restaurantId,
        restaurantGoogleMapUrl: googleMapUrl,
        submissionRecord,
    })
    const history = buildSourceSubmissionHistory({
        googleMapUrl,
        sourceSubmission,
        submissionRecord,
        auditEvents,
        latestPublishedBatch,
        ...sourceState,
    })

    return {
        ...sourceSubmission,
        timeline: buildSourceSubmissionTimeline({
            sourceSubmission,
            submissionRecord,
            history,
            source: sourceState.source,
            latestRun: sourceState.latestRun,
        }),
    }
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
    const { latestPublishedBatch, openBatches } = await fetchIntakeSummary(restaurantId)
    const sourceSubmission = await buildCurrentSourceSubmission(
        restaurantId,
        access.restaurant.googleMapUrl,
        latestPublishedBatch,
    )

    return {
        id: access.restaurant.id,
        name: access.restaurant.name,
        slug: access.restaurant.slug,
        address: access.restaurant.address,
        googleMapUrl: access.restaurant.googleMapUrl,
        datasetStatus: buildDatasetStatus({ latestPublishedBatch, openBatches }),
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
    const { latestPublishedBatch } = await fetchIntakeSummary(restaurantId)
    const [submissionRecord, auditEvents] = await Promise.all([
        fetchPersistedSourceSubmissionRecord(restaurantId),
        fetchRestaurantSourceSubmissionHistoryAuditEvents(restaurantId),
    ])
    const currentSourceSubmission = await buildCurrentSourceSubmission(
        restaurantId,
        access.restaurant.googleMapUrl,
        latestPublishedBatch,
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
