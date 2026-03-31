#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { loadEnvFiles } = require('./load-env-files')
const {
    loginAndReadSession,
    requestJsonWithRetries,
} = require('./staging-proof-helpers')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'operational-health-check.json',
)
const DEFAULT_AVERAGE_PROOF_PATH = path.join(
    'load-reports',
    'staging-performance-proof-average.json',
)
const DEFAULT_STRONGER_PROOF_PATH = path.join(
    'load-reports',
    'staging-performance-proof-strengthened.json',
)
const DEFAULT_REVIEW_OPS_PROOF_PATH = path.join(
    'load-reports',
    'staging-review-ops-proof-strengthened.json',
)
const DEFAULT_REDIS_PROOF_PATH = path.join(
    'load-reports',
    'managed-redis-proof-current.json',
)

function readFlag(args, name) {
    const inline = args.find((value) => value.startsWith(`${name}=`))

    if (inline) {
        return inline.slice(`${name}=`.length)
    }

    const index = args.findIndex((value) => value === name)
    if (index === -1) {
        return undefined
    }

    return args[index + 1]
}

function hasFlag(args, name) {
    return args.includes(name)
}

function parsePositiveInt(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/operational-health-check.js [options]',
            '',
            'Options:',
            '  --refresh                    Rerun managed Redis, staging average read, stronger read, and review-ops proofs',
            '  --base-url <url>             Staging API base URL',
            '  --admin-email <email>        Admin staging email',
            '  --admin-password <password>  Admin staging password',
            '  --timeout-ms <ms>            Request timeout for live health checks (default: 60000)',
            '  --insecure-tls               Disable TLS verification',
            '  --output <file>              Write JSON report',
            '  --help                       Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_STAGING_API_URL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_TIMEOUT_MS',
            '  RELEASE_EVIDENCE_STAGING_INSECURE_TLS',
        ].join('\n'),
    )
}

function readJsonIfExists(filePath) {
    const resolvedPath = path.resolve(filePath)

    if (!fs.existsSync(resolvedPath)) {
        return null
    }

    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
}

function runNodeScript(scriptName, args) {
    const scriptPath = path.resolve(__dirname, scriptName)
    const child = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
    })

    return {
        ok: !child.error && (child.status ?? 1) === 0,
        status: child.status ?? 1,
        stdout: child.stdout || '',
        stderr: child.stderr || '',
        error: child.error ? String(child.error) : null,
    }
}

function buildExternalReadSummary(report) {
    if (!report) {
        return {
            status: 'MISSING',
            passed: false,
            observed: null,
        }
    }

    return {
        status: report.overallStatus || 'UNKNOWN',
        passed: report.overallStatus === 'STAGING_PERFORMANCE_PROOF_COMPLETE',
        observed: {
            requestCount: report.overall?.requestCount ?? null,
            errorRatePercent: report.overall?.errorRatePercent ?? null,
            p50Ms: report.overall?.p50Ms ?? null,
            p95Ms: report.overall?.p95Ms ?? null,
            p99Ms: report.overall?.p99Ms ?? null,
            requestsPerSecond: report.overall?.requestsPerSecond ?? null,
            predictability:
                report.overall?.predictability?.classification ?? null,
        },
    }
}

function buildReviewOpsSummary(report) {
    if (!report) {
        return {
            status: 'MISSING',
            passed: false,
            observed: null,
        }
    }

    return {
        status: report.overallStatus || 'UNKNOWN',
        passed: report.overallStatus === 'STAGING_REVIEW_OPS_PROOF_COMPLETE',
        observed: {
            runStatus: report.evaluation?.observed?.status ?? null,
            queueJobState: report.evaluation?.observed?.queueJobState ?? null,
            extractedCount: report.evaluation?.observed?.extractedCount ?? null,
            totalWallClockMs:
                report.evaluation?.observed?.totalWallClockMs ?? null,
            rawReviewsPerSecond:
                report.evaluation?.observed?.rawReviewsPerSecond ?? null,
        },
    }
}

function buildManagedRedisSummary(report) {
    if (!report) {
        return {
            status: 'MISSING',
            passed: false,
            observed: null,
        }
    }

    return {
        status:
            report.result?.passed === true
                ? 'PASSED'
                : report.result?.passed === false
                  ? 'FAILED'
                  : 'UNKNOWN',
        passed: report.result?.passed === true,
        observed: {
            redisVersion: report.redis?.redisVersion ?? null,
            maxMemoryPolicy: report.redis?.maxMemoryPolicy ?? null,
            safeForBullMq: report.redis?.safeForBullMq ?? null,
            evictionPolicyStatus: report.redis?.evictionPolicyStatus ?? null,
        },
    }
}

function classifyOperationalPosture({
    liveHealth,
    managedRedis,
    averageRead,
    strongerRead,
    reviewOps,
}) {
    const recommendations = []
    const runtimeHealthy =
        liveHealth.publicHealth?.status === 200 &&
        liveHealth.apiHealth?.status === 200 &&
        liveHealth.apiHealth?.body?.status === 'ok' &&
        liveHealth.apiHealth?.body?.db === 'up'
    const adminControlPlaneReachable = liveHealth.adminHealthJobs?.status === 200
    const operatorPathCorrect = reviewOps.passed
    const averageCaseHealthy = averageRead.passed
    const strongerConcurrencyHealthy = strongerRead.passed
    const redisDurable = managedRedis.passed

    if (!runtimeHealthy) {
        recommendations.push(
            'Restore live runtime health before trusting any higher-level proof.',
        )
    }

    if (!adminControlPlaneReachable) {
        recommendations.push(
            'Re-establish admin control-plane health checks and operator visibility.',
        )
    }

    if (!operatorPathCorrect) {
        recommendations.push(
            'Operator flow is not completing cleanly on staging; fix crawl->materialize behavior before release claims.',
        )
    }

    if (!redisDurable) {
        recommendations.push(
            'Managed Redis must use maxmemory-policy=noeviction before BullMQ durability can be called safe.',
        )
    }

    if (!averageCaseHealthy) {
        recommendations.push(
            'Average-case merchant read latency is outside the accepted bar; optimize or change topology before release.',
        )
    }

    if (!strongerConcurrencyHealthy) {
        recommendations.push(
            'Worst-case read predictability is not strong enough under higher concurrency; do not claim strong latency confidence on the current staging topology.',
        )
    }

    let overallStatus = 'OPERATIONAL_HEALTH_COMPLETE'

    if (!runtimeHealthy || !adminControlPlaneReachable || !operatorPathCorrect) {
        overallStatus = 'OPERATIONAL_HEALTH_FAILED'
    } else if (!redisDurable || !averageCaseHealthy || !strongerConcurrencyHealthy) {
        overallStatus = 'OPERATIONAL_HEALTH_DEGRADED'
    }

    return {
        overallStatus,
        dimensions: {
            liveRuntime: runtimeHealthy ? 'PASS' : 'FAIL',
            adminControlPlane: adminControlPlaneReachable ? 'PASS' : 'FAIL',
            operatorPathCorrectness: operatorPathCorrect ? 'PASS' : 'FAIL',
            redisDurability: redisDurable ? 'PASS' : 'FAIL',
            averageCaseRead: averageCaseHealthy ? 'PASS' : 'FAIL',
            strongerConcurrencyRead: strongerConcurrencyHealthy ? 'PASS' : 'FAIL',
        },
        recommendations,
    }
}

async function fetchLiveHealth({
    baseUrl,
    adminEmail,
    adminPassword,
    timeoutMs,
    insecureTls,
    warmupRetries,
    warmupDelayMs,
}) {
    const requestOptions = {
        timeoutMs,
        insecureTls,
        retryAttempts: warmupRetries + 1,
        retryDelayMs: warmupDelayMs,
    }
    const publicHealth = await requestJsonWithRetries(
        baseUrl,
        '/health',
        requestOptions,
    )
    const apiHealth = await requestJsonWithRetries(
        baseUrl,
        '/api/health',
        requestOptions,
    )

    let adminHealthJobs = {
        status: null,
        body: null,
        loginStatus: null,
        sessionStatus: null,
    }

    if (adminEmail && adminPassword) {
        const auth = await loginAndReadSession({
            baseUrl,
            email: adminEmail,
            password: adminPassword,
            timeoutMs,
            insecureTls,
            retryAttempts: warmupRetries + 1,
            retryDelayMs: warmupDelayMs,
        })

        adminHealthJobs.loginStatus = auth.loginStatus
        adminHealthJobs.sessionStatus = auth.sessionStatus

        if (auth.passed) {
            const response = await requestJsonWithRetries(
                baseUrl,
                '/api/admin/platform/health-jobs',
                {
                    cookieJar: auth.cookieJar,
                    timeoutMs,
                    insecureTls,
                    retryAttempts: warmupRetries + 1,
                    retryDelayMs: warmupDelayMs,
                },
            )
            adminHealthJobs.status = response.status
            adminHealthJobs.body = response.body ?? null
        }
    }

    return {
        publicHealth: {
            status: publicHealth.status,
            body: publicHealth.body ?? null,
        },
        apiHealth: {
            status: apiHealth.status,
            body: apiHealth.body ?? null,
        },
        adminHealthJobs,
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const baseUrl =
        readFlag(args, '--base-url') || process.env.RELEASE_EVIDENCE_STAGING_API_URL
    const adminEmail =
        readFlag(args, '--admin-email') || process.env.RELEASE_EVIDENCE_STAGING_ADMIN_EMAIL
    const adminPassword =
        readFlag(args, '--admin-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_ADMIN_PASSWORD
    const timeoutMs = parsePositiveInt(
        readFlag(args, '--timeout-ms') ||
            process.env.RELEASE_EVIDENCE_STAGING_TIMEOUT_MS,
        60000,
    )
    const insecureTls =
        hasFlag(args, '--insecure-tls') ||
        process.env.RELEASE_EVIDENCE_STAGING_INSECURE_TLS === 'true'
    const refresh = hasFlag(args, '--refresh')
    const warmupRetries = parsePositiveInt(readFlag(args, '--warmup-retries'), 2)
    const warmupDelayMs = parsePositiveInt(readFlag(args, '--warmup-delay-ms'), 3000)
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH

    if (!baseUrl) {
        throw new Error('A staging base URL is required')
    }

    const averageProofPath = path.resolve(DEFAULT_AVERAGE_PROOF_PATH)
    const strongerProofPath = path.resolve(DEFAULT_STRONGER_PROOF_PATH)
    const reviewOpsProofPath = path.resolve(DEFAULT_REVIEW_OPS_PROOF_PATH)
    const redisProofPath = path.resolve(DEFAULT_REDIS_PROOF_PATH)

    const startedAt = new Date()

    const liveHealth = await fetchLiveHealth({
        baseUrl,
        adminEmail,
        adminPassword,
        timeoutMs,
        insecureTls,
        warmupRetries,
        warmupDelayMs,
    })

    const childRuns = []

    if (refresh) {
        childRuns.push({
            key: 'managedRedis',
            run: runNodeScript('managed-redis-proof.js', [
                '--output',
                redisProofPath,
            ]),
        })
        childRuns.push({
            key: 'averageRead',
            run: runNodeScript('staging-performance-proof.js', [
                '--concurrency',
                '2',
                '--rounds',
                '20',
                '--timeout-ms',
                String(timeoutMs),
                '--max-p95-ms',
                '5000',
                '--max-error-rate',
                '0',
                '--min-rps',
                '2',
                '--max-cv-percent',
                '45',
                '--max-p95-p50-ratio',
                '3.5',
                '--output',
                averageProofPath,
            ]),
        })
        childRuns.push({
            key: 'strongerRead',
            run: runNodeScript('staging-performance-proof.js', [
                '--concurrency',
                '4',
                '--rounds',
                '30',
                '--timeout-ms',
                String(timeoutMs),
                '--max-p95-ms',
                '5000',
                '--max-error-rate',
                '0',
                '--min-rps',
                '2',
                '--max-cv-percent',
                '45',
                '--max-p95-p50-ratio',
                '3.5',
                '--output',
                strongerProofPath,
            ]),
        })
        childRuns.push({
            key: 'reviewOps',
            run: runNodeScript('staging-review-ops-proof.js', [
                '--timeout-ms',
                '600000',
                '--max-total-wallclock-ms',
                '300000',
                '--output',
                reviewOpsProofPath,
            ]),
        })
    }

    const averageRead = buildExternalReadSummary(readJsonIfExists(averageProofPath))
    const strongerRead = buildExternalReadSummary(readJsonIfExists(strongerProofPath))
    const reviewOps = buildReviewOpsSummary(readJsonIfExists(reviewOpsProofPath))
    const managedRedis = buildManagedRedisSummary(readJsonIfExists(redisProofPath))

    const evaluation = classifyOperationalPosture({
        liveHealth,
        managedRedis,
        averageRead,
        strongerRead,
        reviewOps,
    })

    const finishedAt = new Date()
    const report = {
        generatedAt: finishedAt.toISOString(),
        benchmark: {
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: refresh ? 'fresh_external_operational_audit' : 'artifact_operational_audit',
        },
        target: {
            baseUrl,
        },
        configuration: {
            timeoutMs,
            warmupRetries,
            warmupDelayMs,
            refresh,
        },
        liveHealth,
        proofs: {
            managedRedis,
            averageRead,
            strongerRead,
            reviewOps,
        },
        evaluation,
        childRuns: childRuns.map((entry) => ({
            key: entry.key,
            ok: entry.run.ok,
            status: entry.run.status,
            stdout: entry.run.stdout.trim(),
            stderr: entry.run.stderr.trim(),
            error: entry.run.error,
        })),
        notes: [
            'This audit deliberately separates correctness, average-case latency, stronger-concurrency latency, and Redis durability.',
            'A green average-case read proof does not justify strong worst-case claims if the stronger-concurrency proof fails.',
            'Operator-path correctness and Redis durability are tracked independently because queue jobs can complete even when the Redis eviction policy is unsafe.',
        ],
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(
        resolvedOutputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
    )

    process.stdout.write(
        `${JSON.stringify(
            {
                overallStatus: evaluation.overallStatus,
                dimensions: evaluation.dimensions,
                recommendations: evaluation.recommendations,
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(
        `Operational health report written to ${resolvedOutputPath}\n`,
    )

    if (evaluation.overallStatus !== 'OPERATIONAL_HEALTH_COMPLETE') {
        process.exitCode = 1
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error?.stack || error?.message || String(error))
        process.exitCode = 1
    })
}

module.exports = {
    buildExternalReadSummary,
    buildManagedRedisSummary,
    buildReviewOpsSummary,
    classifyOperationalPosture,
}
