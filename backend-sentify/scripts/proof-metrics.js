function round(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null
    }

    const factor = 10 ** digits
    return Math.round(value * factor) / factor
}

function mean(values) {
    if (!values.length) {
        return null
    }

    const total = values.reduce((sum, value) => sum + value, 0)
    return round(total / values.length, 2)
}

function percentile(values, targetPercentile) {
    if (!values.length) {
        return null
    }

    const sorted = [...values].sort((left, right) => left - right)
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((targetPercentile / 100) * sorted.length) - 1),
    )

    return round(sorted[index], 2)
}

function standardDeviation(values) {
    if (!values.length) {
        return null
    }

    if (values.length === 1) {
        return 0
    }

    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance =
        values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
        values.length

    return round(Math.sqrt(variance), 2)
}

function ratio(numerator, denominator) {
    if (
        numerator === null ||
        numerator === undefined ||
        denominator === null ||
        denominator === undefined ||
        denominator <= 0
    ) {
        return null
    }

    return round(numerator / denominator, 2)
}

function classifyPredictability({
    count,
    coefficientOfVariationPercent,
    p95ToP50Ratio,
    p99ToP95Ratio,
}) {
    if (!count || count < 5) {
        return 'INSUFFICIENT_DATA'
    }

    if (
        coefficientOfVariationPercent !== null &&
        coefficientOfVariationPercent <= 15 &&
        p95ToP50Ratio !== null &&
        p95ToP50Ratio <= 1.8 &&
        p99ToP95Ratio !== null &&
        p99ToP95Ratio <= 1.35
    ) {
        return 'STABLE'
    }

    if (
        coefficientOfVariationPercent !== null &&
        coefficientOfVariationPercent <= 35 &&
        p95ToP50Ratio !== null &&
        p95ToP50Ratio <= 3 &&
        p99ToP95Ratio !== null &&
        p99ToP95Ratio <= 2
    ) {
        return 'VARIABLE'
    }

    return 'VOLATILE'
}

function summarizeNumericSeries(values) {
    const present = values.filter((value) => typeof value === 'number')
    const averageMs = mean(present)
    const p50Ms = percentile(present, 50)
    const p95Ms = percentile(present, 95)
    const p99Ms = percentile(present, 99)
    const stdDevMs = standardDeviation(present)
    const coefficientOfVariationPercent =
        averageMs && stdDevMs !== null ? round((stdDevMs / averageMs) * 100, 2) : null
    const p95ToP50Ratio = ratio(p95Ms, p50Ms)
    const p99ToP95Ratio = ratio(p99Ms, p95Ms)
    const p99ToP50Ratio = ratio(p99Ms, p50Ms)

    return {
        count: present.length,
        average: averageMs,
        p50: p50Ms,
        p95: p95Ms,
        p99: p99Ms,
        max: present.length ? round(Math.max(...present), 2) : null,
        min: present.length ? round(Math.min(...present), 2) : null,
        stdDev: stdDevMs,
        coefficientOfVariationPercent,
        p95ToP50Ratio,
        p99ToP95Ratio,
        p99ToP50Ratio,
        predictability: {
            classification: classifyPredictability({
                count: present.length,
                coefficientOfVariationPercent,
                p95ToP50Ratio,
                p99ToP95Ratio,
            }),
        },
    }
}

function summarizeLatencySeries(values, totalDurationMs = null) {
    const summary = summarizeNumericSeries(values)

    return {
        count: summary.count,
        averageMs: summary.average,
        p50Ms: summary.p50,
        p95Ms: summary.p95,
        p99Ms: summary.p99,
        maxMs: summary.max,
        minMs: summary.min,
        stdDevMs: summary.stdDev,
        coefficientOfVariationPercent: summary.coefficientOfVariationPercent,
        p95ToP50Ratio: summary.p95ToP50Ratio,
        p99ToP95Ratio: summary.p99ToP95Ratio,
        p99ToP50Ratio: summary.p99ToP50Ratio,
        predictability: summary.predictability,
        requestsPerSecond:
            totalDurationMs && totalDurationMs > 0
                ? round(summary.count / (totalDurationMs / 1000), 2)
                : null,
    }
}

function summarizeUtilizationProxy({
    configuredConcurrency,
    averageObserved,
    maxObserved,
    sampleCount,
}) {
    if (!configuredConcurrency || configuredConcurrency <= 0) {
        return {
            configuredConcurrency: configuredConcurrency ?? null,
            averageObserved: averageObserved ?? null,
            maxObserved: maxObserved ?? null,
            sampleCount: sampleCount ?? 0,
            averageUtilizationPercent: null,
            peakUtilizationPercent: null,
            classification: 'UNCONFIGURED',
        }
    }

    const averageUtilizationPercent = round(
        ((averageObserved ?? 0) / configuredConcurrency) * 100,
        2,
    )
    const peakUtilizationPercent = round(
        ((maxObserved ?? 0) / configuredConcurrency) * 100,
        2,
    )

    let classification = 'IDLE'

    if (peakUtilizationPercent > 100) {
        classification = 'OVERSUBSCRIBED'
    } else if (averageUtilizationPercent >= 85) {
        classification = 'SATURATED'
    } else if (
        averageUtilizationPercent >= 60 &&
        peakUtilizationPercent >= 80
    ) {
        classification = 'HEALTHY'
    } else if (averageUtilizationPercent > 0 || peakUtilizationPercent > 0) {
        classification = 'LOW'
    }

    return {
        configuredConcurrency,
        averageObserved: round(averageObserved ?? 0, 2),
        maxObserved: maxObserved ?? 0,
        sampleCount: sampleCount ?? 0,
        averageUtilizationPercent,
        peakUtilizationPercent,
        classification,
    }
}

module.exports = {
    classifyPredictability,
    mean,
    percentile,
    ratio,
    round,
    summarizeNumericSeries,
    standardDeviation,
    summarizeLatencySeries,
    summarizeUtilizationProxy,
}
