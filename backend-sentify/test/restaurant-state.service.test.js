const test = require('node:test')
const assert = require('node:assert/strict')

const {
    buildDatasetStatus,
} = require('../src/services/restaurant-state.service')

test('buildDatasetStatus prefers explicit aggregate counts over synthetic batch items', () => {
    const result = buildDatasetStatus({
        latestPublishedBatch: {
            sourceType: 'GOOGLE_MAPS_CRAWL',
            publishedAt: new Date('2026-03-29T10:00:00.000Z'),
        },
        openBatches: [
            {
                status: 'DRAFT',
                items: [],
            },
        ],
        openBatchSummary: {
            pendingBatchCount: 2,
            readyBatchCount: 1,
            pendingItemCount: 7,
            approvedItemCount: 3,
            rejectedItemCount: 2,
        },
    })

    assert.deepEqual(result, {
        sourcePolicy: 'ADMIN_CURATED',
        lastPublishedAt: new Date('2026-03-29T10:00:00.000Z'),
        lastPublishedSourceType: 'GOOGLE_MAPS_CRAWL',
        pendingBatchCount: 2,
        readyBatchCount: 1,
        pendingItemCount: 7,
        approvedItemCount: 3,
        rejectedItemCount: 2,
    })
})

test('buildDatasetStatus falls back to batch item aggregation when explicit counts are unavailable', () => {
    const result = buildDatasetStatus({
        latestPublishedBatch: null,
        openBatches: [
            {
                status: 'DRAFT',
                items: [
                    { approvalStatus: 'PENDING' },
                    { approvalStatus: 'APPROVED' },
                ],
            },
            {
                status: 'READY_TO_PUBLISH',
                items: [{ approvalStatus: 'REJECTED' }],
            },
        ],
    })

    assert.deepEqual(result, {
        sourcePolicy: 'UNCONFIGURED',
        lastPublishedAt: null,
        lastPublishedSourceType: null,
        pendingBatchCount: 2,
        readyBatchCount: 1,
        pendingItemCount: 1,
        approvedItemCount: 1,
        rejectedItemCount: 1,
    })
})
