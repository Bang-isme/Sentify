const { buildSourceSubmissionAuditSnapshot } = require('./restaurant-state.service')

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

function mapSourceSubmissionHistoryActorType(actor) {
    if (!actor) {
        return 'SYSTEM'
    }

    return actor.role === 'ADMIN' ? 'ADMIN' : 'USER'
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
                occurredAt:
                    source?.createdAt ??
                    latestRun?.queuedAt ??
                    openBatch?.createdAt ??
                    publishedBatch?.publishedAt ??
                    null,
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

module.exports = {
    SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
    SOURCE_SUBMISSION_HISTORY_EVENT,
    SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_TIMELINE_STEP_ORDER,
    buildRestaurantSourceSubmissionHistory,
    buildSourceSubmissionAttemptKey,
    buildSourceSubmissionHistory,
    deriveSourceSubmissionTimelineCodeFromAuditAction,
    extractSourceSubmissionAuditSnapshot,
}
