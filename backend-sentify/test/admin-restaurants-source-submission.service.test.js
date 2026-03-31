const test = require('node:test')
const assert = require('node:assert/strict')

const {
    __private: {
        SOURCE_SUBMISSION_QUEUE_PRIORITY,
        SOURCE_SUBMISSION_QUEUE_STATE,
        buildSourceSubmissionNextAction,
        deriveSourceSubmissionPriority,
        isSourceSubmissionClaimActive,
        mapSourceSubmissionClaim,
    },
} = require('../src/modules/admin-restaurants/admin-restaurants-source-submission.service')

test('deriveSourceSubmissionPriority escalates unresolved and priority-lane submissions', () => {
    assert.equal(
        deriveSourceSubmissionPriority(
            SOURCE_SUBMISSION_QUEUE_STATE.RESOLVE_IDENTITY,
            'STANDARD',
        ),
        SOURCE_SUBMISSION_QUEUE_PRIORITY.HIGH,
    )
    assert.equal(
        deriveSourceSubmissionPriority(
            SOURCE_SUBMISSION_QUEUE_STATE.CREATE_SOURCE,
            'PRIORITY',
        ),
        SOURCE_SUBMISSION_QUEUE_PRIORITY.HIGH,
    )
    assert.equal(
        deriveSourceSubmissionPriority(
            SOURCE_SUBMISSION_QUEUE_STATE.REUSE_SHARED_IDENTITY,
            'STANDARD',
        ),
        SOURCE_SUBMISSION_QUEUE_PRIORITY.MEDIUM,
    )
})

test('mapSourceSubmissionClaim marks active leases from future expirations only', () => {
    const now = new Date('2026-03-30T10:00:00.000Z')
    const activeClaim = mapSourceSubmissionClaim(
        {
            claimedByUserId: 'admin-1',
            claimedAt: new Date('2026-03-30T09:50:00.000Z'),
            claimExpiresAt: new Date('2026-03-30T10:05:00.000Z'),
        },
        now,
    )
    const expiredClaim = mapSourceSubmissionClaim(
        {
            claimedByUserId: 'admin-2',
            claimedAt: new Date('2026-03-30T09:30:00.000Z'),
            claimExpiresAt: new Date('2026-03-30T09:59:59.000Z'),
        },
        now,
    )

    assert.equal(activeClaim.isActive, true)
    assert.equal(expiredClaim.isActive, false)
    assert.equal(isSourceSubmissionClaimActive(activeClaim.claimExpiresAt, now), true)
    assert.equal(isSourceSubmissionClaimActive(expiredClaim.claimExpiresAt, now), false)
    assert.equal(
        buildSourceSubmissionNextAction({
            queueState: SOURCE_SUBMISSION_QUEUE_STATE.REUSE_SHARED_IDENTITY,
        }),
        'Review the shared canonical place and reuse that identity when creating the restaurant-specific crawl source.',
    )
})
