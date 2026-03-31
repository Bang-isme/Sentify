const test = require('node:test')
const assert = require('node:assert/strict')

const {
    summarizeLatencySeries,
    summarizeUtilizationProxy,
} = require('../scripts/proof-metrics')

test('summarizeLatencySeries reports stable latency when tail spread is tight', () => {
    const summary = summarizeLatencySeries([100, 102, 101, 99, 103, 100, 101, 102])

    assert.equal(summary.count, 8)
    assert.equal(summary.predictability.classification, 'STABLE')
    assert.equal(summary.p95ToP50Ratio <= 1.8, true)
})

test('summarizeLatencySeries reports volatile latency when spread is wide', () => {
    const summary = summarizeLatencySeries([100, 120, 140, 200, 300, 550, 800, 1200])

    assert.equal(summary.count, 8)
    assert.equal(summary.predictability.classification, 'VOLATILE')
    assert.equal(summary.coefficientOfVariationPercent > 35, true)
})

test('summarizeUtilizationProxy classifies healthy and saturated worker usage', () => {
    const healthy = summarizeUtilizationProxy({
        configuredConcurrency: 4,
        averageObserved: 2.8,
        maxObserved: 4,
        sampleCount: 20,
    })
    const saturated = summarizeUtilizationProxy({
        configuredConcurrency: 4,
        averageObserved: 3.7,
        maxObserved: 4,
        sampleCount: 20,
    })

    assert.equal(healthy.classification, 'HEALTHY')
    assert.equal(healthy.averageUtilizationPercent, 70)
    assert.equal(saturated.classification, 'SATURATED')
    assert.equal(saturated.peakUtilizationPercent, 100)
})
