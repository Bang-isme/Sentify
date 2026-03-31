const { PERSISTED_SOURCE_SUBMISSION_STATUS } = require('./restaurant-state.service')
const {
    SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
    SOURCE_SUBMISSION_HISTORY_EVENT,
    SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_TIMELINE_STEP_ORDER,
    buildRestaurantSourceSubmissionHistory,
    buildSourceSubmissionAttemptKey,
    buildSourceSubmissionHistory,
    deriveSourceSubmissionTimelineCodeFromAuditAction,
    extractSourceSubmissionAuditSnapshot,
} = require('./restaurant-source-submission-history.service')

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

module.exports = {
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
}
