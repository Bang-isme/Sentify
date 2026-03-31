const test = require('node:test')
const assert = require('node:assert/strict')

const {
    buildScenarios,
    summarizeRequestRecords,
    evaluateOverall,
} = require('../scripts/staging-performance-proof')

test('buildScenarios includes merchant actions and review endpoints for a restaurant', () => {
    const scenarios = buildScenarios('restaurant-123')

    assert.equal(scenarios[0].path, '/api/restaurants')
    assert.ok(
        scenarios.some(
            (scenario) =>
                scenario.key === 'dashboard.actions' &&
                scenario.path === '/api/restaurants/restaurant-123/dashboard/actions',
        ),
    )
    assert.ok(
        scenarios.some(
            (scenario) =>
                scenario.key === 'reviews.page' &&
                scenario.path.includes('/api/restaurants/restaurant-123/reviews'),
        ),
    )
})

test('summarizeRequestRecords computes success, errors, and throughput', () => {
    const summary = summarizeRequestRecords(
        [
            { ok: true, durationMs: 120, status: 200 },
            { ok: true, durationMs: 180, status: 200 },
            { ok: false, durationMs: 300, status: null },
        ],
        1000,
    )

    assert.equal(summary.requestCount, 3)
    assert.equal(summary.successCount, 2)
    assert.equal(summary.errorCount, 1)
    assert.equal(summary.errorRatePercent, 33.33)
    assert.equal(summary.p95Ms, 180)
    assert.equal(summary.requestsPerSecond, 3)
    assert.equal(summary.statusCounts.ERROR, 1)
    assert.equal(summary.predictability.classification, 'INSUFFICIENT_DATA')
})

test('evaluateOverall passes only when thresholds are satisfied', () => {
    const passing = evaluateOverall(
        {
            errorRatePercent: 0,
            p95Ms: 420,
            requestsPerSecond: 4.2,
            coefficientOfVariationPercent: 12,
            p95ToP50Ratio: 1.6,
            predictability: { classification: 'STABLE' },
        },
        {
            maxErrorRatePercent: 0,
            maxP95Ms: 1000,
            minRequestsPerSecond: 2,
            maxCoefficientOfVariationPercent: 35,
            maxP95ToP50Ratio: 3,
        },
    )
    const failing = evaluateOverall(
        {
            errorRatePercent: 5,
            p95Ms: 5200,
            requestsPerSecond: 1.2,
            coefficientOfVariationPercent: 65,
            p95ToP50Ratio: 4.1,
            predictability: { classification: 'VOLATILE' },
        },
        {
            maxErrorRatePercent: 0,
            maxP95Ms: 1000,
            minRequestsPerSecond: 2,
            maxCoefficientOfVariationPercent: 35,
            maxP95ToP50Ratio: 3,
        },
    )

    assert.equal(passing.passed, true)
    assert.equal(failing.passed, false)
    assert.equal(passing.observed.predictabilityClassification, 'STABLE')
})
