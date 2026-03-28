const test = require('node:test')
const assert = require('node:assert/strict')

const {
    evaluateReviewOpsProof,
    isStableTerminalRun,
    selectProofSource,
    selectRestaurant,
} = require('../scripts/staging-review-ops-proof')

test('selectRestaurant prefers explicit slug before falling back to first restaurant', () => {
    const restaurants = [
        { id: 'restaurant-1', slug: 'first' },
        { id: 'restaurant-2', slug: 'second' },
    ]

    assert.equal(
        selectRestaurant(restaurants, { restaurantSlug: 'second' }).id,
        'restaurant-2',
    )
    assert.equal(selectRestaurant(restaurants, {}).id, 'restaurant-1')
})

test('selectProofSource prefers an active idle source with an input URL', () => {
    const sources = [
        {
            id: 'source-running',
            status: 'ACTIVE',
            inputUrl: 'https://maps.app.goo.gl/running',
            latestRun: { status: 'RUNNING' },
        },
        {
            id: 'source-idle',
            status: 'ACTIVE',
            inputUrl: 'https://maps.app.goo.gl/idle',
            latestRun: { status: 'COMPLETED' },
        },
    ]

    assert.equal(selectProofSource(sources, {}).id, 'source-idle')
    assert.equal(
        selectProofSource(sources, { sourceId: 'source-running' }).id,
        'source-running',
    )
})

test('isStableTerminalRun requires a terminal run status and settled queue job state', () => {
    assert.equal(
        isStableTerminalRun({
            run: { status: 'RUNNING' },
            queueJob: { state: 'active' },
        }),
        false,
    )
    assert.equal(
        isStableTerminalRun({
            run: { status: 'COMPLETED' },
            queueJob: { state: 'completed' },
        }),
        true,
    )
})

test('evaluateReviewOpsProof requires a materialized terminal run without active-run reuse', () => {
    const passing = evaluateReviewOpsProof(
        {
            run: {
                status: 'COMPLETED',
                intakeBatchId: 'batch-1',
                extractedCount: 42,
                validCount: 40,
                pagesFetched: 3,
                crawlCoverage: {
                    operatorPolicy: {
                        code: 'NONE',
                    },
                },
            },
            queueJob: {
                state: 'completed',
            },
            totalWallClockMs: 12000,
            draftPolicy: {
                reusedActiveRun: false,
            },
        },
        {
            maxTotalWallClockMs: 300000,
            minExtractedCount: 1,
        },
    )
    const failing = evaluateReviewOpsProof(
        {
            run: {
                status: 'FAILED',
                intakeBatchId: null,
                extractedCount: 0,
                validCount: 0,
                pagesFetched: 0,
                crawlCoverage: {
                    operatorPolicy: {
                        code: 'REVIEW_FAILED_RUN',
                    },
                },
            },
            queueJob: {
                state: 'failed',
            },
            totalWallClockMs: 5000,
            draftPolicy: {
                reusedActiveRun: true,
            },
        },
        {
            maxTotalWallClockMs: 300000,
            minExtractedCount: 1,
        },
    )

    assert.equal(passing.passed, true)
    assert.equal(passing.observed.rawReviewsPerSecond, 3.5)
    assert.equal(failing.passed, false)
    assert.equal(failing.observed.reusedActiveRun, true)
})
