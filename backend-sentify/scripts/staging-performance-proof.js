#!/usr/bin/env node

const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { performance } = require('perf_hooks')
const { loadEnvFiles } = require('./load-env-files')
const {
    loginAndReadSession,
    requestJson,
} = require('./staging-proof-helpers')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'staging-performance-proof-managed.json',
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

function round(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null
    }

    const factor = 10 ** digits
    return Math.round(value * factor) / factor
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

function mean(values) {
    if (!values.length) {
        return null
    }

    const total = values.reduce((sum, value) => sum + value, 0)
    return round(total / values.length, 2)
}

function buildScenarios(restaurantId) {
    return [
        {
            key: 'restaurants.list',
            path: '/api/restaurants',
        },
        {
            key: 'restaurant.detail',
            path: `/api/restaurants/${restaurantId}`,
        },
        {
            key: 'reviews.page',
            path: `/api/restaurants/${restaurantId}/reviews?page=1&limit=20`,
        },
        {
            key: 'reviews.rating',
            path: `/api/restaurants/${restaurantId}/reviews?rating=2&page=1&limit=20`,
        },
        {
            key: 'dashboard.kpi',
            path: `/api/restaurants/${restaurantId}/dashboard/kpi`,
        },
        {
            key: 'dashboard.sentiment',
            path: `/api/restaurants/${restaurantId}/dashboard/sentiment`,
        },
        {
            key: 'dashboard.trend',
            path: `/api/restaurants/${restaurantId}/dashboard/trend?period=month`,
        },
        {
            key: 'dashboard.complaints',
            path: `/api/restaurants/${restaurantId}/dashboard/complaints`,
        },
        {
            key: 'dashboard.topIssue',
            path: `/api/restaurants/${restaurantId}/dashboard/top-issue`,
        },
        {
            key: 'dashboard.actions',
            path: `/api/restaurants/${restaurantId}/dashboard/actions`,
        },
    ]
}

function summarizeRequestRecords(records, totalDurationMs = null) {
    const successful = records.filter((record) => record.ok)
    const durations = successful.map((record) => record.durationMs)
    const statusCounts = {}

    for (const record of records) {
        const key = record.status === null ? 'ERROR' : String(record.status)
        statusCounts[key] = (statusCounts[key] || 0) + 1
    }

    return {
        requestCount: records.length,
        successCount: successful.length,
        errorCount: records.length - successful.length,
        errorRatePercent: records.length
            ? round(((records.length - successful.length) / records.length) * 100, 2)
            : 0,
        averageMs: mean(durations),
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        p99Ms: percentile(durations, 99),
        maxMs: durations.length ? round(Math.max(...durations), 2) : null,
        minMs: durations.length ? round(Math.min(...durations), 2) : null,
        requestsPerSecond:
            totalDurationMs && totalDurationMs > 0
                ? round(records.length / (totalDurationMs / 1000), 2)
                : null,
        statusCounts,
    }
}

function evaluateOverall(summary, thresholds) {
    const passed =
        typeof summary.errorRatePercent === 'number' &&
        typeof summary.p95Ms === 'number' &&
        typeof summary.requestsPerSecond === 'number' &&
        summary.errorRatePercent <= thresholds.maxErrorRatePercent &&
        summary.p95Ms <= thresholds.maxP95Ms &&
        summary.requestsPerSecond >= thresholds.minRequestsPerSecond

    return {
        passed,
        observed: {
            errorRatePercent: summary.errorRatePercent,
            p95Ms: summary.p95Ms,
            requestsPerSecond: summary.requestsPerSecond,
        },
        thresholds,
    }
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/staging-performance-proof.js [options]',
            '',
            'Options:',
            '  --base-url <url>               Deployed staging API base URL',
            '  --user-email <email>           Merchant USER email',
            '  --user-password <password>     Merchant USER password',
            '  --restaurant-id <id>           Optional restaurant id override',
            '  --restaurant-slug <slug>       Optional restaurant slug override',
            '  --concurrency <n>              Concurrent workers (default: 2)',
            '  --rounds <n>                   Requests per worker (default: 20)',
            '  --timeout-ms <ms>              Per-request timeout (default: 60000)',
            '  --max-p95-ms <ms>              Default: 5000',
            '  --max-error-rate <percent>     Default: 0',
            '  --min-rps <n>                  Default: 2',
            '  --insecure-tls                 Disable TLS verification',
            `  --output <file>                Write JSON report (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --help                         Show this help message',
            '',
            'Environment fallbacks:',
            '  RELEASE_EVIDENCE_STAGING_API_URL',
            '  RELEASE_EVIDENCE_STAGING_USER_EMAIL',
            '  RELEASE_EVIDENCE_STAGING_USER_PASSWORD',
            '  RELEASE_EVIDENCE_STAGING_TIMEOUT_MS',
            '  RELEASE_EVIDENCE_STAGING_INSECURE_TLS',
            '  RELEASE_EVIDENCE_RESTAURANT_SLUGS',
        ].join('\n'),
    )
}

async function login(baseUrl, email, password, options) {
    const auth = await loginAndReadSession({
        baseUrl,
        email,
        password,
        timeoutMs: options.timeoutMs,
        insecureTls: options.insecureTls,
        agent: options.agent,
    })

    return {
        passed: auth.passed,
        loginStatus: auth.loginStatus,
        loginBody: auth.login?.body ?? null,
        cookieJar: auth.cookieJar,
        sessionStatus: auth.sessionStatus,
        sessionBody: auth.session ? { data: auth.session } : null,
    }
}

function resolveRestaurant(restaurants, restaurantId, restaurantSlug) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) {
        return null
    }

    if (restaurantId) {
        return restaurants.find((restaurant) => restaurant.id === restaurantId) || null
    }

    if (restaurantSlug) {
        return (
            restaurants.find((restaurant) => restaurant.slug === restaurantSlug) || null
        )
    }

    return restaurants[0]
}

async function warmup(baseUrl, scenarios, cookieJar, options) {
    for (const scenario of scenarios) {
        await requestJson(baseUrl, scenario.path, {
            cookieJar,
            timeoutMs: options.timeoutMs,
            insecureTls: options.insecureTls,
            agent: options.agent,
        })
    }
}

async function runScenarioLoad({
    baseUrl,
    scenarios,
    cookieJar,
    concurrency,
    rounds,
    timeoutMs,
    insecureTls,
    agent,
}) {
    const totalRequests = concurrency * rounds
    const tasks = Array.from({ length: totalRequests }, (_, index) => ({
        scenario: scenarios[index % scenarios.length],
        requestIndex: index + 1,
    }))
    const results = []
    let cursor = 0
    const startedAt = performance.now()

    async function workerLoop(workerIndex) {
        while (true) {
            const taskIndex = cursor
            cursor += 1

            if (taskIndex >= tasks.length) {
                return
            }

            const task = tasks[taskIndex]
            const requestStartedAt = performance.now()

            try {
                const response = await requestJson(baseUrl, task.scenario.path, {
                    cookieJar,
                    timeoutMs,
                    insecureTls,
                    agent,
                })
                const durationMs = performance.now() - requestStartedAt

                results.push({
                    workerIndex,
                    requestIndex: task.requestIndex,
                    scenarioKey: task.scenario.key,
                    path: task.scenario.path,
                    durationMs: round(durationMs, 2),
                    status: response.status,
                    ok: response.status >= 200 && response.status < 300,
                })
            } catch (error) {
                const durationMs = performance.now() - requestStartedAt

                results.push({
                    workerIndex,
                    requestIndex: task.requestIndex,
                    scenarioKey: task.scenario.key,
                    path: task.scenario.path,
                    durationMs: round(durationMs, 2),
                    status: null,
                    ok: false,
                    error: error.message,
                })
            }
        }
    }

    await Promise.all(
        Array.from({ length: concurrency }, (_, index) => workerLoop(index + 1)),
    )

    return {
        totalDurationMs: round(performance.now() - startedAt, 2),
        results,
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
    const userEmail =
        readFlag(args, '--user-email') || process.env.RELEASE_EVIDENCE_STAGING_USER_EMAIL
    const userPassword =
        readFlag(args, '--user-password') ||
        process.env.RELEASE_EVIDENCE_STAGING_USER_PASSWORD
    const restaurantId = readFlag(args, '--restaurant-id')
    const restaurantSlug =
        readFlag(args, '--restaurant-slug') ||
        process.env.RELEASE_EVIDENCE_RESTAURANT_SLUGS?.split(',')[0]?.trim() ||
        undefined
    const timeoutMs = parsePositiveInt(
        readFlag(args, '--timeout-ms') ||
            process.env.RELEASE_EVIDENCE_STAGING_TIMEOUT_MS,
        60000,
    )
    const concurrency = parsePositiveInt(readFlag(args, '--concurrency'), 2)
    const rounds = parsePositiveInt(readFlag(args, '--rounds'), 20)
    const insecureTls =
        hasFlag(args, '--insecure-tls') ||
        process.env.RELEASE_EVIDENCE_STAGING_INSECURE_TLS === 'true'
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const thresholds = {
        maxP95Ms: parsePositiveInt(readFlag(args, '--max-p95-ms'), 5000),
        maxErrorRatePercent: parsePositiveInt(readFlag(args, '--max-error-rate'), 0),
        minRequestsPerSecond: parsePositiveInt(readFlag(args, '--min-rps'), 2),
    }

    if (!baseUrl || !userEmail || !userPassword) {
        printUsage()
        process.exitCode = 1
        return
    }

    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const isHttps = normalizedBaseUrl.startsWith('https://')
    const agent = isHttps
        ? new https.Agent({
              keepAlive: true,
              maxSockets: concurrency,
              rejectUnauthorized: !insecureTls,
          })
        : new http.Agent({
              keepAlive: true,
              maxSockets: concurrency,
          })

    try {
        const auth = await login(normalizedBaseUrl, userEmail, userPassword, {
            timeoutMs,
            insecureTls,
            agent,
        })

        if (!auth.passed) {
            throw new Error(
                `Staging login/session failed (login=${auth.loginStatus}, session=${auth.sessionStatus || 'n/a'})`,
            )
        }

        const restaurantsResponse = await requestJson(
            normalizedBaseUrl,
            '/api/restaurants',
            {
                cookieJar: auth.cookieJar,
                timeoutMs,
                insecureTls,
                agent,
            },
        )

        if (restaurantsResponse.status !== 200) {
            throw new Error(
                `Unable to resolve staging restaurant list (status=${restaurantsResponse.status})`,
            )
        }

        const restaurants = restaurantsResponse.body?.data || []
        const restaurant = resolveRestaurant(restaurants, restaurantId, restaurantSlug)

        if (!restaurant) {
            throw new Error('Unable to resolve a merchant-visible restaurant for staging proof')
        }

        const scenarios = buildScenarios(restaurant.id)
        await warmup(normalizedBaseUrl, scenarios, auth.cookieJar, {
            timeoutMs,
            insecureTls,
            agent,
        })

        const run = await runScenarioLoad({
            baseUrl: normalizedBaseUrl,
            scenarios,
            cookieJar: auth.cookieJar,
            concurrency,
            rounds,
            timeoutMs,
            insecureTls,
            agent,
        })

        const overall = summarizeRequestRecords(run.results, run.totalDurationMs)
        const evaluation = evaluateOverall(overall, thresholds)
        const scenarioSummaries = Object.fromEntries(
            scenarios.map((scenario) => [
                scenario.key,
                summarizeRequestRecords(
                    run.results.filter((record) => record.scenarioKey === scenario.key),
                ),
            ]),
        )

        const report = {
            generatedAt: new Date().toISOString(),
            target: {
                baseUrl: normalizedBaseUrl,
                restaurantId: restaurant.id,
                restaurantSlug: restaurant.slug || null,
            },
            authentication: {
                userEmail,
                loginStatus: auth.loginStatus,
                sessionStatus: auth.sessionStatus,
                restaurantCount: Array.isArray(restaurants) ? restaurants.length : 0,
            },
            configuration: {
                concurrency,
                roundsPerWorker: rounds,
                timeoutMs,
                scenarioCount: scenarios.length,
                totalRequests: concurrency * rounds,
                thresholds,
            },
            execution: {
                warmupRequests: scenarios.length,
                totalDurationMs: run.totalDurationMs,
                throughputRequestsPerSecond: overall.requestsPerSecond,
            },
            overallStatus: evaluation.passed
                ? 'STAGING_PERFORMANCE_PROOF_COMPLETE'
                : 'STAGING_PERFORMANCE_PROOF_FAILED',
            overall,
            evaluation,
            scenarios: scenarioSummaries,
            notes: [
                'This proof measures authenticated merchant read-path latency directly against the deployed staging API.',
                'It is intentionally HTTP-only. Queue and worker-pressure proof remain separate because Render free staging is not a reliable worker-throughput benchmark.',
                'Warmup requests are excluded from the measured totals to avoid counting free-tier cold start latency as steady-state application latency.',
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
                    overallStatus: report.overallStatus,
                    restaurantSlug: restaurant.slug || null,
                    overall: {
                        requestCount: overall.requestCount,
                        errorRatePercent: overall.errorRatePercent,
                        p95Ms: overall.p95Ms,
                        requestsPerSecond: overall.requestsPerSecond,
                    },
                },
                null,
                2,
            )}\n`,
        )
        process.stdout.write(
            `Staging performance proof report written to ${resolvedOutputPath}\n`,
        )

        if (!evaluation.passed) {
            process.exitCode = 1
        }
    } finally {
        agent.destroy()
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error?.stack || error?.message || String(error))
        process.exitCode = 1
    })
}

module.exports = {
    buildScenarios,
    summarizeRequestRecords,
    evaluateOverall,
}
