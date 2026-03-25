#!/usr/bin/env node

require('dotenv').config()

const fs = require('fs')
const http = require('http')
const path = require('path')
const { randomBytes } = require('crypto')
const { performance } = require('perf_hooks')

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

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/load-merchant-reads.js [options]',
            '',
            'Options:',
            '  --restaurant-id <uuid>     Optional. Defaults to seeded Demo Quan Pho Hong.',
            '  --extra-reviews <n>        Additional synthetic reviews to insert (default: 4000).',
            '  --chunk-size <n>           createMany chunk size for synthetic reviews (default: 1000).',
            '  --concurrency <n>          Concurrent HTTP workers (default: 8).',
            '  --rounds <n>               Requests per worker (default: 45).',
            '  --timeout-ms <n>           Per-request timeout (default: 10000).',
            '  --output <file>            Write JSON report to a file.',
        ].join('\n'),
    )
}

function stopServer(server) {
    if (!server) {
        return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

function buildSyntheticReview(restaurantId, index) {
    const ratingPattern = [5, 4, 5, 3, 2, 1, 4, 5, 2, 4]
    const rating = ratingPattern[index % ratingPattern.length]
    const sentiment =
        rating >= 4 ? 'POSITIVE' : rating === 3 ? 'NEUTRAL' : 'NEGATIVE'
    const negativeKeywordPool = ['slow', 'service', 'noise', 'cleanliness']
    const positiveKeywordPool = ['fresh', 'friendly', 'clean']
    const neutralKeywordPool = ['okay']
    const keywordPool =
        sentiment === 'NEGATIVE'
            ? negativeKeywordPool
            : sentiment === 'POSITIVE'
              ? positiveKeywordPool
              : neutralKeywordPool
    const month = index % 12
    const day = (index % 28) + 1
    const year = 2025 + Math.floor((index % 24) / 12)
    const reviewDate = new Date(Date.UTC(year, month, day, 12, 0, 0))
    const createdAt = new Date(reviewDate.getTime() + 60 * 60 * 1000)
    const keywords =
        sentiment === 'NEGATIVE'
            ? [
                  keywordPool[index % keywordPool.length],
                  keywordPool[(index + 1) % keywordPool.length],
              ]
            : [keywordPool[index % keywordPool.length]]

    return {
        restaurantId,
        externalId: `merchant-load-${String(index).padStart(6, '0')}`,
        authorName: `Load Reviewer ${index}`,
        rating,
        content:
            sentiment === 'NEGATIVE'
                ? `Synthetic merchant load review ${index}: slow service, noisy room, and uneven cleanliness at dinner.`
                : sentiment === 'NEUTRAL'
                  ? `Synthetic merchant load review ${index}: overall okay visit with average experience.`
                  : `Synthetic merchant load review ${index}: fresh food, friendly team, and quick service.`,
        sentiment,
        keywords,
        reviewDate,
        createdAt,
        updatedAt: createdAt,
    }
}

async function insertSyntheticReviews(prisma, restaurantId, extraReviews, chunkSize) {
    let inserted = 0

    for (
        let chunkStart = 0;
        chunkStart < extraReviews;
        chunkStart += chunkSize
    ) {
        const currentChunkSize = Math.min(chunkSize, extraReviews - chunkStart)
        const data = []

        for (let offset = 0; offset < currentChunkSize; offset += 1) {
            const index = chunkStart + offset
            data.push(buildSyntheticReview(restaurantId, index))
        }

        await prisma.review.createMany({
            data,
        })

        inserted += data.length
    }

    return inserted
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
    ]
}

function executeJsonRequest(server, agent, requestPath, token, timeoutMs) {
    const address = server.address()

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: address.port,
                path: requestPath,
                method: 'GET',
                agent,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            (res) => {
                let body = ''

                res.on('data', (chunk) => {
                    body += chunk
                })

                res.on('end', () => {
                    let parsedBody = body

                    if (body) {
                        try {
                            parsedBody = JSON.parse(body)
                        } catch {}
                    }

                    resolve({
                        status: res.statusCode ?? 0,
                        body: parsedBody,
                    })
                })
            },
        )

        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Request timed out after ${timeoutMs}ms`))
        })

        req.once('error', reject)
        req.end()
    })
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

async function warmup(server, agent, scenarios, token, timeoutMs) {
    for (const scenario of scenarios) {
        await executeJsonRequest(server, agent, scenario.path, token, timeoutMs)
    }
}

async function runScenarioLoad({
    server,
    agent,
    scenarios,
    token,
    concurrency,
    rounds,
    timeoutMs,
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
                const response = await executeJsonRequest(
                    server,
                    agent,
                    task.scenario.path,
                    token,
                    timeoutMs,
                )
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

    if (args.includes('--help')) {
        printUsage()
        return
    }

    const options = {
        restaurantId: readFlag(args, '--restaurant-id'),
        extraReviews: parsePositiveInt(readFlag(args, '--extra-reviews'), 4000),
        chunkSize: parsePositiveInt(readFlag(args, '--chunk-size'), 1000),
        concurrency: parsePositiveInt(readFlag(args, '--concurrency'), 8),
        rounds: parsePositiveInt(readFlag(args, '--rounds'), 45),
        timeoutMs: parsePositiveInt(readFlag(args, '--timeout-ms'), 10000),
        output: readFlag(args, '--output'),
    }

    process.env.NODE_ENV = 'test'
    process.env.LOG_FORMAT = process.env.LOG_FORMAT || 'json'
    process.env.API_RATE_LIMIT_MAX = process.env.API_RATE_LIMIT_MAX || '100000'
    process.env.JWT_SECRET =
        process.env.JWT_SECRET || randomBytes(32).toString('hex')
    process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'sentify-api'
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'sentify-web'

    const prisma = require('../src/lib/prisma')
    const { seedDemoData } = require('../prisma/seed-data')
    const { recalculateRestaurantInsights } = require('../src/services/insight.service')
    const { createTestToken } = require('../test/test-helpers')
    const app = require('../src/app')

    let server = null
    let agent = null

    try {
        const seedSummary = await seedDemoData({ prisma })
        const restaurantId =
            options.restaurantId || seedSummary.restaurants.phoHong.id
        const userToken = createTestToken({
            userId: seedSummary.users.userPrimary.id,
            tokenVersion: 0,
        })

        const insertedSyntheticReviews = await insertSyntheticReviews(
            prisma,
            restaurantId,
            options.extraReviews,
            options.chunkSize,
        )

        await recalculateRestaurantInsights({ restaurantId })

        const totalReviews = await prisma.review.count({
            where: { restaurantId },
        })

        server = app.listen(0)
        agent = new http.Agent({
            keepAlive: true,
            maxSockets: options.concurrency,
        })

        const scenarios = buildScenarios(restaurantId)
        await warmup(server, agent, scenarios, userToken, options.timeoutMs)

        const run = await runScenarioLoad({
            server,
            agent,
            scenarios,
            token: userToken,
            concurrency: options.concurrency,
            rounds: options.rounds,
            timeoutMs: options.timeoutMs,
        })

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
            configuration: {
                concurrency: options.concurrency,
                roundsPerWorker: options.rounds,
                timeoutMs: options.timeoutMs,
                scenarioCount: scenarios.length,
                totalRequests: options.concurrency * options.rounds,
            },
            dataset: {
                restaurantId,
                syntheticReviewsInserted: insertedSyntheticReviews,
                totalCanonicalReviews: totalReviews,
            },
            execution: {
                warmupRequests: scenarios.length,
                totalDurationMs: run.totalDurationMs,
                throughputRequestsPerSecond: round(
                    run.results.length / (run.totalDurationMs / 1000),
                    2,
                ),
            },
            overall: summarizeRequestRecords(run.results, run.totalDurationMs),
            scenarios: scenarioSummaries,
            notes: [
                'This harness seeds the real local Postgres app state, expands one restaurant with synthetic canonical reviews, and benchmarks the real Express read surface over HTTP.',
                'Numbers are local-machine evidence for SMB-scale reads, not a universal production SLA.',
            ],
        }

        const text = `${JSON.stringify(report, null, 2)}\n`

        if (options.output) {
            const outputPath = path.resolve(options.output)
            fs.mkdirSync(path.dirname(outputPath), { recursive: true })
            fs.writeFileSync(outputPath, text, 'utf8')
            process.stdout.write(`${outputPath}\n`)
            return
        }

        process.stdout.write(text)
    } finally {
        if (agent) {
            agent.destroy()
        }

        await stopServer(server)

        if (typeof prisma.disconnect === 'function') {
            await prisma.disconnect()
        } else if (typeof prisma.$disconnect === 'function') {
            await prisma.$disconnect()
        }
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exit(1)
})

