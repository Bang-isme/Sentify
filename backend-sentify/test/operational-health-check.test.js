const test = require('node:test')
const assert = require('node:assert/strict')

const {
    buildExternalReadSummary,
    buildManagedRedisSummary,
    buildReviewOpsSummary,
    classifyOperationalPosture,
} = require('../scripts/operational-health-check')

test('classifyOperationalPosture returns COMPLETE only when all dimensions pass', () => {
    const result = classifyOperationalPosture({
        liveHealth: {
            publicHealth: { status: 200 },
            apiHealth: { status: 200, body: { status: 'ok', db: 'up' } },
            adminHealthJobs: { status: 200 },
        },
        managedRedis: { passed: true },
        averageRead: { passed: true },
        strongerRead: { passed: true },
        reviewOps: { passed: true },
    })

    assert.equal(result.overallStatus, 'OPERATIONAL_HEALTH_COMPLETE')
    assert.deepEqual(result.dimensions, {
        liveRuntime: 'PASS',
        adminControlPlane: 'PASS',
        operatorPathCorrectness: 'PASS',
        redisDurability: 'PASS',
        averageCaseRead: 'PASS',
        strongerConcurrencyRead: 'PASS',
    })
})

test('classifyOperationalPosture returns DEGRADED for durability and stronger-concurrency gaps', () => {
    const result = classifyOperationalPosture({
        liveHealth: {
            publicHealth: { status: 200 },
            apiHealth: { status: 200, body: { status: 'ok', db: 'up' } },
            adminHealthJobs: { status: 200 },
        },
        managedRedis: { passed: false },
        averageRead: { passed: true },
        strongerRead: { passed: false },
        reviewOps: { passed: true },
    })

    assert.equal(result.overallStatus, 'OPERATIONAL_HEALTH_DEGRADED')
    assert.match(
        result.recommendations.join(' '),
        /noeviction/i,
    )
    assert.match(
        result.recommendations.join(' '),
        /worst-case read predictability/i,
    )
})

test('classifyOperationalPosture returns FAILED when live runtime or operator path is broken', () => {
    const result = classifyOperationalPosture({
        liveHealth: {
            publicHealth: { status: 200 },
            apiHealth: { status: 503, body: { status: 'unavailable', db: 'down' } },
            adminHealthJobs: { status: 500 },
        },
        managedRedis: { passed: true },
        averageRead: { passed: true },
        strongerRead: { passed: true },
        reviewOps: { passed: false },
    })

    assert.equal(result.overallStatus, 'OPERATIONAL_HEALTH_FAILED')
})

test('summary builders derive pass/fail from child proof payloads', () => {
    assert.deepEqual(
        buildManagedRedisSummary({
            result: { passed: false },
            redis: {
                redisVersion: '8.4.0',
                maxMemoryPolicy: 'volatile-lru',
                safeForBullMq: false,
                evictionPolicyStatus: 'FAILED',
            },
        }),
        {
            status: 'FAILED',
            passed: false,
            observed: {
                redisVersion: '8.4.0',
                maxMemoryPolicy: 'volatile-lru',
                safeForBullMq: false,
                evictionPolicyStatus: 'FAILED',
            },
        },
    )

    assert.deepEqual(
        buildExternalReadSummary({
            overallStatus: 'STAGING_PERFORMANCE_PROOF_COMPLETE',
            overall: {
                requestCount: 40,
                errorRatePercent: 0,
                p50Ms: 100,
                p95Ms: 200,
                p99Ms: 300,
                requestsPerSecond: 2.5,
                predictability: { classification: 'VARIABLE' },
            },
        }),
        {
            status: 'STAGING_PERFORMANCE_PROOF_COMPLETE',
            passed: true,
            observed: {
                requestCount: 40,
                errorRatePercent: 0,
                p50Ms: 100,
                p95Ms: 200,
                p99Ms: 300,
                requestsPerSecond: 2.5,
                predictability: 'VARIABLE',
            },
        },
    )

    assert.deepEqual(
        buildReviewOpsSummary({
            overallStatus: 'STAGING_REVIEW_OPS_PROOF_COMPLETE',
            evaluation: {
                observed: {
                    status: 'COMPLETED',
                    queueJobState: 'completed',
                    extractedCount: 30,
                    totalWallClockMs: 15000,
                    rawReviewsPerSecond: 2,
                },
            },
        }),
        {
            status: 'STAGING_REVIEW_OPS_PROOF_COMPLETE',
            passed: true,
            observed: {
                runStatus: 'COMPLETED',
                queueJobState: 'completed',
                extractedCount: 30,
                totalWallClockMs: 15000,
                rawReviewsPerSecond: 2,
            },
        },
    )
})
