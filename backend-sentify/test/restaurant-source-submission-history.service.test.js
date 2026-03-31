const test = require('node:test')
const assert = require('node:assert/strict')

const {
    SOURCE_SUBMISSION_HISTORY_EVENT,
    buildRestaurantSourceSubmissionHistory,
    buildSourceSubmissionAttemptKey,
    deriveSourceSubmissionTimelineCodeFromAuditAction,
} = require('../src/services/restaurant-source-submission-history.service')
const {
    buildSourceSubmissionAuditSnapshot,
} = require('../src/services/restaurant-state.service')

test('deriveSourceSubmissionTimelineCodeFromAuditAction maps durable audit actions to timeline milestones', () => {
    assert.equal(
        deriveSourceSubmissionTimelineCodeFromAuditAction('MERCHANT_SOURCE_UPDATED'),
        SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED,
    )
    assert.equal(
        deriveSourceSubmissionTimelineCodeFromAuditAction('ADMIN_SOURCE_SUBMISSION_RESOLVED'),
        SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED,
    )
    assert.equal(
        deriveSourceSubmissionTimelineCodeFromAuditAction(
            'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
        ),
        SOURCE_SUBMISSION_HISTORY_EVENT.SOURCE_CONNECTED,
    )
    assert.equal(
        deriveSourceSubmissionTimelineCodeFromAuditAction(
            'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
        ),
        SOURCE_SUBMISSION_HISTORY_EVENT.ATTENTION_REQUIRED,
    )
})

test('buildRestaurantSourceSubmissionHistory groups audit events by attempt key and marks the active attempt', () => {
    const currentSnapshot = buildSourceSubmissionAuditSnapshot({
        inputUrl: 'https://maps.app.goo.gl/current',
        status: 'PENDING_IDENTITY_RESOLUTION',
        schedulingLane: 'STANDARD',
        submittedAt: new Date('2026-03-27T12:00:00.000Z'),
    })
    const previousSnapshot = buildSourceSubmissionAuditSnapshot({
        inputUrl: 'https://maps.app.goo.gl/previous',
        canonicalCid: 'cid-1',
        placeName: 'Demo Place',
        status: 'READY_FOR_SOURCE_LINK',
        schedulingLane: 'PRIORITY',
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
                metadataJson: { sourceSubmissionSnapshot: currentSnapshot },
            },
            {
                id: 'audit-previous',
                action: 'ADMIN_SOURCE_SUBMISSION_RESOLVED',
                summary: 'Admin resolved the place.',
                actorUserId: 'admin-1',
                actor: { id: 'admin-1', role: 'ADMIN' },
                createdAt: new Date('2026-03-26T09:02:00.000Z'),
                metadataJson: { sourceSubmissionSnapshot: previousSnapshot },
            },
        ],
        currentAttemptKey,
    )

    assert.equal(history.attempts.length, 2)
    assert.equal(history.events.length, 2)
    assert.equal(history.attempts[0].attemptKey, currentAttemptKey)
    assert.equal(history.attempts[0].isCurrentAttempt, true)
    assert.equal(history.attempts[1].canonicalCid, 'cid-1')
    assert.equal(
        history.events[0].timelineCode,
        SOURCE_SUBMISSION_HISTORY_EVENT.URL_SUBMITTED,
    )
    assert.equal(
        history.events[1].timelineCode,
        SOURCE_SUBMISSION_HISTORY_EVENT.PLACE_CONFIRMED,
    )
})
