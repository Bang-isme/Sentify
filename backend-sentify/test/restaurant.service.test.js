const test = require('node:test')
const assert = require('node:assert/strict')

const restaurantService = require('../src/services/restaurant.service')

const {
    PERSISTED_SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_HISTORY_EVENT,
    SOURCE_SUBMISSION_STATUS,
    buildRestaurantSourceSubmissionHistory,
    buildSourceSubmissionAttemptKey,
    buildSourceSubmissionAuditSnapshot,
    buildInitialSourceSubmission,
    buildSourceSubmissionHistory,
    buildSourceSubmissionFromState,
    buildSourceSubmissionTimeline,
    deriveSourceSubmissionDedupeKey,
} = restaurantService.__private

test('buildInitialSourceSubmission returns UNCONFIGURED when no URL exists', () => {
    const result = buildInitialSourceSubmission(null)

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.UNCONFIGURED)
    assert.equal(result.currentUrl, null)
    assert.equal(result.needsUserAction, true)
    assert.equal(result.needsAdminAction, false)
})

test('buildInitialSourceSubmission returns SUBMITTED when a URL exists but no source is synced yet', () => {
    const result = buildInitialSourceSubmission('https://maps.app.goo.gl/demo')

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.SUBMITTED)
    assert.equal(result.currentUrl, 'https://maps.app.goo.gl/demo')
    assert.equal(result.needsUserAction, false)
    assert.equal(result.needsAdminAction, true)
})

test('buildInitialSourceSubmission surfaces canonical-place-ready state before a crawl source exists', () => {
    const result = buildInitialSourceSubmission('https://maps.app.goo.gl/demo', {
        id: 'submission-1',
        status: PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK,
        inputUrl: 'https://maps.app.goo.gl/demo',
        normalizedUrl: 'https://www.google.com/maps?cid=cid-1',
        canonicalCid: 'cid-1',
        placeName: 'Demo Place',
        googlePlaceId: 'place-id-1',
        placeHexId: '0x123:0x456',
        recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
        recommendationMessage: 'Canonical place ready for admin source creation.',
        linkedSourceId: null,
        submittedAt: new Date('2026-03-27T10:00:00.000Z'),
        lastResolvedAt: new Date('2026-03-27T10:00:00.000Z'),
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.SUBMITTED)
    assert.equal(
        result.message,
        'Google Maps place identity is confirmed and is waiting for admin to create the crawl source.',
    )
    assert.equal(result.submission.status, PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK)
})

test('deriveSourceSubmissionDedupeKey prefers canonical cid and falls back to normalized or input URL', () => {
    assert.equal(
        deriveSourceSubmissionDedupeKey({
            canonicalCid: '4548797685071303380',
            normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380',
            inputUrl: 'https://maps.app.goo.gl/demo',
        }),
        'cid:4548797685071303380',
    )
    assert.equal(
        deriveSourceSubmissionDedupeKey({
            canonicalCid: null,
            normalizedUrl: 'https://www.google.com/maps?cid=4548797685071303380',
            inputUrl: 'https://maps.app.goo.gl/demo',
        }),
        'url:https://www.google.com/maps?cid=4548797685071303380',
    )
    assert.equal(
        deriveSourceSubmissionDedupeKey({
            canonicalCid: null,
            normalizedUrl: null,
            inputUrl: 'https://maps.app.goo.gl/demo',
        }),
        'url:https://maps.app.goo.gl/demo',
    )
})

test('buildSourceSubmissionFromState returns QUEUED while the latest run is queued', () => {
    const result = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
        },
        latestRun: {
            id: 'run-1',
            status: 'QUEUED',
            queuedAt: new Date('2026-03-27T10:00:00.000Z'),
            startedAt: null,
            finishedAt: null,
            validCount: 0,
            warningCount: 0,
            errorCode: null,
            errorMessage: null,
        },
        openBatch: null,
        publishedBatch: null,
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.QUEUED)
    assert.equal(result.latestRun.status, 'QUEUED')
    assert.equal(result.needsAdminAction, false)
})

test('buildSourceSubmissionFromState returns REVIEWING when crawl evidence is staged in an open batch', () => {
    const result = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: null,
            lastSuccessfulRunAt: new Date('2026-03-27T10:05:00.000Z'),
        },
        latestRun: {
            id: 'run-1',
            status: 'PARTIAL',
            queuedAt: new Date('2026-03-27T10:00:00.000Z'),
            startedAt: new Date('2026-03-27T10:01:00.000Z'),
            finishedAt: new Date('2026-03-27T10:05:00.000Z'),
            validCount: 3,
            warningCount: 1,
            errorCode: null,
            errorMessage: null,
        },
        openBatch: {
            id: 'batch-1',
            status: 'IN_REVIEW',
            title: 'Draft triage',
            updatedAt: new Date('2026-03-27T10:06:00.000Z'),
            createdAt: new Date('2026-03-27T10:05:30.000Z'),
        },
        publishedBatch: {
            id: 'batch-live-1',
            status: 'PUBLISHED',
            title: 'Previous live batch',
            publishedAt: new Date('2026-03-26T09:00:00.000Z'),
        },
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.REVIEWING)
    assert.equal(result.openBatch.status, 'IN_REVIEW')
    assert.equal(result.publishedFromSource, true)
    assert.equal(result.needsAdminAction, true)
})

test('buildSourceSubmissionFromState returns READY_TO_PUBLISH when the open batch is publishable', () => {
    const result = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: null,
            lastSuccessfulRunAt: new Date('2026-03-27T10:05:00.000Z'),
        },
        latestRun: null,
        openBatch: {
            id: 'batch-1',
            status: 'READY_TO_PUBLISH',
            title: 'Draft triage',
            updatedAt: new Date('2026-03-27T10:06:00.000Z'),
            createdAt: new Date('2026-03-27T10:05:30.000Z'),
        },
        publishedBatch: null,
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.READY_TO_PUBLISH)
    assert.equal(result.needsAdminAction, true)
})

test('buildSourceSubmissionFromState returns LIVE when a Google Maps source has already been published', () => {
    const result = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: new Date('2026-03-27T10:05:00.000Z'),
            lastSuccessfulRunAt: new Date('2026-03-27T10:05:00.000Z'),
        },
        latestRun: {
            id: 'run-1',
            status: 'COMPLETED',
            queuedAt: new Date('2026-03-27T10:00:00.000Z'),
            startedAt: new Date('2026-03-27T10:01:00.000Z'),
            finishedAt: new Date('2026-03-27T10:05:00.000Z'),
            validCount: 4,
            warningCount: 0,
            errorCode: null,
            errorMessage: null,
        },
        openBatch: null,
        publishedBatch: {
            id: 'batch-live-1',
            status: 'PUBLISHED',
            title: 'Live batch',
            publishedAt: new Date('2026-03-27T10:10:00.000Z'),
        },
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.LIVE)
    assert.equal(result.latestPublishedBatch.status, 'PUBLISHED')
    assert.equal(result.needsAdminAction, false)
})

test('buildSourceSubmissionFromState returns NEEDS_ATTENTION when the source is disabled', () => {
    const result = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'DISABLED',
            syncEnabled: false,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
        },
        latestRun: null,
        openBatch: null,
        publishedBatch: null,
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.NEEDS_ATTENTION)
    assert.equal(result.needsAdminAction, true)
})

test('buildSourceSubmissionFromState exposes persisted submission metadata and links it to a live source', () => {
    const result = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: null,
            lastSuccessfulRunAt: null,
        },
        latestRun: null,
        openBatch: null,
        publishedBatch: null,
        sourceSubmissionRecord: {
            id: 'submission-1',
            status: PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK,
            inputUrl: 'https://maps.app.goo.gl/demo',
            normalizedUrl: 'https://www.google.com/maps?cid=cid-1',
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            googlePlaceId: 'place-id-1',
            placeHexId: '0x123:0x456',
            recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
            recommendationMessage: 'Saved and waiting for admin sync.',
            linkedSourceId: null,
            submittedAt: new Date('2026-03-27T10:00:00.000Z'),
            lastResolvedAt: new Date('2026-03-27T10:00:00.000Z'),
        },
    })

    assert.equal(result.status, SOURCE_SUBMISSION_STATUS.SOURCE_READY)
    assert.equal(result.submission.status, PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE)
    assert.equal(result.submission.linkedSourceId, 'source-1')
    assert.equal(result.submission.googlePlaceId, 'place-id-1')
})

test('buildSourceSubmissionHistory and timeline expose merchant-facing milestones for a canonical-ready submission', () => {
    const sourceSubmission = buildInitialSourceSubmission('https://maps.app.goo.gl/demo', {
        id: 'submission-1',
        status: PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK,
        inputUrl: 'https://maps.app.goo.gl/demo',
        normalizedUrl: 'https://www.google.com/maps?cid=cid-1',
        canonicalCid: 'cid-1',
        placeName: 'Demo Place',
        googlePlaceId: 'place-id-1',
        placeHexId: '0x123:0x456',
        recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
        recommendationMessage: 'Canonical place ready for admin source creation.',
        linkedSourceId: null,
        submittedAt: new Date('2026-03-27T10:00:00.000Z'),
        lastResolvedAt: new Date('2026-03-27T10:02:00.000Z'),
    })
    const history = buildSourceSubmissionHistory({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        sourceSubmission,
        submissionRecord: {
            id: 'submission-1',
            canonicalCid: 'cid-1',
            submittedAt: new Date('2026-03-27T10:00:00.000Z'),
            lastResolvedAt: new Date('2026-03-27T10:02:00.000Z'),
        },
        auditEvents: [],
    })
    const timeline = buildSourceSubmissionTimeline({
        sourceSubmission,
        submissionRecord: {
            id: 'submission-1',
            canonicalCid: 'cid-1',
            submittedAt: new Date('2026-03-27T10:00:00.000Z'),
            lastResolvedAt: new Date('2026-03-27T10:02:00.000Z'),
        },
        history,
    })

    assert.deepEqual(
        history.events.map((event) => event.code),
        [
            SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED,
            SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED,
        ],
    )
    assert.equal(timeline.currentStage, SOURCE_SUBMISSION_STATUS.SUBMITTED)
    assert.equal(timeline.currentStepCode, SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED)
    assert.equal(
        timeline.steps.find((step) => step.code === SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED)
            .state,
        'completed',
    )
    assert.equal(
        timeline.steps.find((step) => step.code === SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED)
            .state,
        'current',
    )
})

test('buildSourceSubmissionHistory preserves live publish history while current state needs attention', () => {
    const sourceSubmission = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: new Date('2026-03-27T11:00:00.000Z'),
            lastSuccessfulRunAt: new Date('2026-03-27T11:00:00.000Z'),
        },
        latestRun: {
            id: 'run-1',
            status: 'FAILED',
            requestedByUserId: null,
            queuedAt: new Date('2026-03-27T12:00:00.000Z'),
            startedAt: new Date('2026-03-27T12:01:00.000Z'),
            finishedAt: new Date('2026-03-27T12:04:00.000Z'),
            validCount: 0,
            warningCount: 0,
            errorCode: 'GOOGLE_MAPS_FETCH_FAILED',
            errorMessage: 'Fetch failed',
        },
        openBatch: null,
        publishedBatch: {
            id: 'batch-live-1',
            status: 'PUBLISHED',
            title: 'Live batch',
            publishedAt: new Date('2026-03-27T10:10:00.000Z'),
        },
    })
    const history = buildSourceSubmissionHistory({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        sourceSubmission,
        source: {
            id: 'source-1',
            createdAt: new Date('2026-03-27T09:55:00.000Z'),
            updatedAt: new Date('2026-03-27T12:04:00.000Z'),
            lastSuccessfulRunAt: new Date('2026-03-27T11:00:00.000Z'),
        },
        latestRun: {
            id: 'run-1',
            status: 'FAILED',
            requestedByUserId: null,
            queuedAt: new Date('2026-03-27T12:00:00.000Z'),
            startedAt: new Date('2026-03-27T12:01:00.000Z'),
            finishedAt: new Date('2026-03-27T12:04:00.000Z'),
        },
        publishedBatch: {
            id: 'batch-live-1',
            publishedAt: new Date('2026-03-27T10:10:00.000Z'),
        },
        auditEvents: [],
    })

    assert.ok(
        history.events.some((event) => event.code === SOURCE_SUBMISSION_HISTORY_EVENT.LIVE),
    )
    assert.ok(
        history.events.some((event) => event.code === SOURCE_SUBMISSION_HISTORY_EVENT.SYNC_FAILED),
    )
})

test('buildSourceSubmissionHistory falls back to the latest published Google Maps batch when live data predates current source linkage', () => {
    const sourceSubmission = buildSourceSubmissionFromState({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        source: {
            id: 'source-1',
            provider: 'GOOGLE_MAPS',
            status: 'ACTIVE',
            syncEnabled: true,
            canonicalCid: 'cid-1',
            placeName: 'Demo Place',
            lastSyncedAt: new Date('2026-03-27T11:00:00.000Z'),
            lastSuccessfulRunAt: new Date('2026-03-27T11:00:00.000Z'),
        },
        latestRun: {
            id: 'run-1',
            status: 'PARTIAL',
            requestedByUserId: null,
            queuedAt: new Date('2026-03-27T12:00:00.000Z'),
            startedAt: new Date('2026-03-27T12:01:00.000Z'),
            finishedAt: new Date('2026-03-27T12:04:00.000Z'),
            validCount: 3,
            warningCount: 1,
            errorCode: null,
            errorMessage: null,
        },
        openBatch: {
            id: 'batch-open-1',
            status: 'IN_REVIEW',
            title: 'Open batch',
            createdAt: new Date('2026-03-27T12:05:00.000Z'),
            updatedAt: new Date('2026-03-27T12:05:00.000Z'),
        },
        publishedBatch: null,
        latestPublishedBatch: {
            id: 'legacy-live-batch',
            status: 'PUBLISHED',
            sourceType: 'GOOGLE_MAPS_CRAWL',
            publishedAt: new Date('2026-03-26T09:30:00.000Z'),
        },
    })
    const history = buildSourceSubmissionHistory({
        googleMapUrl: 'https://maps.app.goo.gl/demo',
        sourceSubmission,
        source: {
            id: 'source-1',
            createdAt: new Date('2026-03-27T09:55:00.000Z'),
            updatedAt: new Date('2026-03-27T12:04:00.000Z'),
        },
        latestRun: {
            id: 'run-1',
            status: 'PARTIAL',
            requestedByUserId: null,
            queuedAt: new Date('2026-03-27T12:00:00.000Z'),
            startedAt: new Date('2026-03-27T12:01:00.000Z'),
            finishedAt: new Date('2026-03-27T12:04:00.000Z'),
        },
        openBatch: {
            id: 'batch-open-1',
            status: 'IN_REVIEW',
            createdAt: new Date('2026-03-27T12:05:00.000Z'),
            updatedAt: new Date('2026-03-27T12:05:00.000Z'),
        },
        latestPublishedBatch: {
            id: 'legacy-live-batch',
            status: 'PUBLISHED',
            sourceType: 'GOOGLE_MAPS_CRAWL',
            publishedAt: new Date('2026-03-26T09:30:00.000Z'),
        },
        auditEvents: [],
    })
    const timeline = buildSourceSubmissionTimeline({
        sourceSubmission,
        history,
    })

    const liveEvent = history.events.find(
        (event) => event.code === SOURCE_SUBMISSION_HISTORY_EVENT.LIVE,
    )

    assert.ok(liveEvent)
    assert.equal(liveEvent.source, 'DATASET')
    assert.equal(
        new Date(liveEvent.occurredAt).toISOString(),
        '2026-03-26T09:30:00.000Z',
    )
    assert.equal(timeline.isLive, true)
    assert.equal(
        timeline.steps.find((step) => step.code === SOURCE_SUBMISSION_HISTORY_EVENT.LIVE).state,
        'completed',
    )
})

test('buildRestaurantSourceSubmissionHistory groups durable audit events by attempt key and marks the current attempt', () => {
    const currentSnapshot = buildSourceSubmissionAuditSnapshot({
        id: 'submission-1',
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/current',
        normalizedUrl: null,
        canonicalCid: null,
        placeName: null,
        dedupeKey: 'url:https://maps.app.goo.gl/current',
        status: 'PENDING_IDENTITY_RESOLUTION',
        schedulingLane: 'STANDARD',
        linkedSourceId: null,
        recommendationCode: 'SUBMIT_FOR_ADMIN_SYNC',
        recommendationMessage: 'Needs resolution.',
        submittedAt: new Date('2026-03-27T12:00:00.000Z'),
        lastResolvedAt: null,
    })
    const previousSnapshot = buildSourceSubmissionAuditSnapshot({
        id: 'submission-1',
        provider: 'GOOGLE_MAPS',
        inputUrl: 'https://maps.app.goo.gl/previous',
        normalizedUrl: 'https://www.google.com/maps?cid=cid-1',
        canonicalCid: 'cid-1',
        placeName: 'Demo Place',
        dedupeKey: 'cid:cid-1',
        status: 'READY_FOR_SOURCE_LINK',
        schedulingLane: 'PRIORITY',
        linkedSourceId: null,
        recommendationCode: 'REUSE_SHARED_IDENTITY',
        recommendationMessage: 'Known place.',
        submittedAt: new Date('2026-03-26T09:00:00.000Z'),
        lastResolvedAt: new Date('2026-03-26T09:02:00.000Z'),
    })
    const currentAttemptKey = buildSourceSubmissionAttemptKey(currentSnapshot)
    const history = buildRestaurantSourceSubmissionHistory(
        [
            {
                id: 'audit-current',
                action: 'MERCHANT_SOURCE_UPDATED',
                summary: 'Merchant updated the URL.',
                actorUserId: 'user-1',
                actor: { id: 'user-1', role: 'USER' },
                createdAt: new Date('2026-03-27T12:00:00.000Z'),
                metadataJson: {
                    sourceSubmissionSnapshot: currentSnapshot,
                },
            },
            {
                id: 'audit-previous',
                action: 'ADMIN_SOURCE_SUBMISSION_RESOLVED',
                summary: 'Admin resolved the place.',
                actorUserId: 'admin-1',
                actor: { id: 'admin-1', role: 'ADMIN' },
                createdAt: new Date('2026-03-26T09:02:00.000Z'),
                metadataJson: {
                    sourceSubmissionSnapshot: previousSnapshot,
                },
            },
        ],
        currentAttemptKey,
    )

    assert.equal(history.attempts.length, 2)
    assert.equal(history.events.length, 2)
    assert.equal(history.attempts[0].attemptKey, currentAttemptKey)
    assert.equal(history.attempts[0].isCurrentAttempt, true)
    assert.equal(history.attempts[0].lastKnownPersistedStatus, 'PENDING_IDENTITY_RESOLUTION')
    assert.equal(history.attempts[1].canonicalCid, 'cid-1')
    assert.equal(history.events[0].timelineCode, SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED)
    assert.equal(history.events[1].timelineCode, SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED)
})
