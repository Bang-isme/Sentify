#!/usr/bin/env node

require('dotenv').config()

const crypto = require('node:crypto')
const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { performance } = require('perf_hooks')
const {
    round,
    summarizeLatencySeries,
    summarizeNumericSeries,
    summarizeUtilizationProxy,
} = require('./proof-metrics')
const { runResetBaseline } = require('./proof-baseline')

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

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/load-review-crawl-workers.js [options]',
            '',
            'Options:',
            '  --source-count <n>        Number of synthetic crawl sources/runs (default: 24).',
            '  --concurrency <n>         Worker or inline pool concurrency (default: 4).',
            '  --pages-per-run <n>       Synthetic pages persisted by each run (default: 12).',
            '  --reviews-per-page <n>    Synthetic raw reviews per page (default: 20).',
            '  --step-ms <n>             Delay between synthetic page checkpoints (default: 40).',
            '  --sample-ms <n>           Poll interval for observed concurrency (default: 100).',
            '  --queue-name <name>       Review crawl queue name to isolate the load harness.',
            '  --force-local-redis       Ignore configured REDIS_URL and start embedded/local Redis if available.',
            '  --force-inline            Force inline queue mode and skip Redis transport entirely.',
            '  --skip-baseline-reset     Reuse the current local database instead of resetting to the seeded baseline first.',
            '  --output <file>           Write JSON report to a file.',
            '',
            'Behavior:',
            '  - If REDIS_URL or a local redis binary is available, the harness uses the real BullMQ worker runtime.',
            '  - Otherwise it falls back to inline queue mode and runs the same synthetic processor with an in-process pool.',
            '  - The synthetic processor still writes ReviewCrawlRun checkpoints and ReviewCrawlRawReview rows so DB pressure is real.',
        ].join('\n'),
    )
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer()

        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            server.close((error) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve(address.port)
            })
        })
    })
}

function getRedisBinaryCandidates() {
    const candidates = []
    const envCandidate = process.env.REVIEW_CRAWL_REDIS_BINARY

    if (envCandidate) {
        candidates.push(envCandidate)
    }

    candidates.push('redis-server', 'memurai', 'memurai.exe')
    candidates.push('C:\\ProgramData\\chocolatey\\lib\\redis\\tools\\redis-server.exe')
    candidates.push('C:\\ProgramData\\chocolatey\\lib\\redis-64\\tools\\redis-server.exe')
    candidates.push(
        'C:\\ProgramData\\chocolatey\\lib\\memurai-developer.portable\\tools\\memurai.exe',
    )

    return [...new Set(candidates)]
}

function canSpawn(binary) {
    try {
        const result = spawnSync(binary, ['--help'], {
            stdio: 'ignore',
            windowsHide: true,
        })
        return !result.error
    } catch {
        return false
    }
}

function resolveRedisBinary() {
    for (const candidate of getRedisBinaryCandidates()) {
        if (!candidate.includes('\\') && !candidate.includes('/')) {
            if (canSpawn(candidate)) {
                return candidate
            }

            continue
        }

        if (fs.existsSync(candidate)) {
            return candidate
        }
    }

    return null
}

async function waitForPort(host, port, timeoutMs) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        try {
            await new Promise((resolve, reject) => {
                const socket = net.createConnection({ host, port })

                socket.once('connect', () => {
                    socket.destroy()
                    resolve()
                })
                socket.once('error', reject)
            })
            return
        } catch {
            await sleep(250)
        }
    }

    throw new Error(`Timed out waiting for Redis on ${host}:${port}`)
}

function buildRedisArgs(port, workdir) {
    const dbDir = path.join(workdir, 'data')
    fs.mkdirSync(dbDir, { recursive: true })

    return [
        '--port',
        String(port),
        '--bind',
        '127.0.0.1',
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        dbDir,
    ]
}

async function startLocalRedisIfNeeded({
    forceLocalRedis = false,
    forceInline = false,
} = {}) {
    if (forceInline) {
        process.env.REDIS_URL = ''
        process.env.REVIEW_CRAWL_INLINE_QUEUE_MODE = 'true'

        return {
            mode: 'inline',
            redisUrl: null,
            child: null,
            tempDir: null,
        }
    }

    if (forceLocalRedis) {
        process.env.REDIS_URL = ''
    }

    if (!forceLocalRedis && process.env.REDIS_URL) {
        return {
            mode: 'redis',
            redisUrl: process.env.REDIS_URL,
            child: null,
            tempDir: null,
        }
    }

    const binary = resolveRedisBinary()

    if (!binary) {
        process.env.REDIS_URL = ''
        process.env.REVIEW_CRAWL_INLINE_QUEUE_MODE = 'true'

        return {
            mode: 'inline',
            redisUrl: null,
            child: null,
            tempDir: null,
        }
    }

    const port = await getFreePort()
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'sentify-load-review-crawl-redis-'),
    )

    const child = spawn(binary, buildRedisArgs(port, tempDir), {
        cwd: tempDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    let startupLog = ''
    child.stdout.on('data', (chunk) => {
        startupLog += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
        startupLog += chunk.toString()
    })
    child.once('exit', (code) => {
        if (code !== null && code !== 0) {
            process.stderr.write(
                `Embedded Redis exited early with code ${code}\n${startupLog}\n`,
            )
        }
    })

    await waitForPort('127.0.0.1', port, 20000)

    const redisUrl = `redis://127.0.0.1:${port}`
    process.env.REDIS_URL = redisUrl

    return {
        mode: 'redis',
        redisUrl,
        child,
        tempDir,
    }
}

async function stopLocalRedis(state) {
    if (!state?.child) {
        return
    }

    const child = state.child
    let exited = false
    const exitPromise = new Promise((resolve) => {
        child.once('exit', () => {
            exited = true
            resolve()
        })
    })

    child.kill('SIGTERM')
    await Promise.race([exitPromise, sleep(5000)])

    if (!exited) {
        child.kill('SIGKILL')
    }

    if (state.tempDir) {
        fs.rmSync(state.tempDir, { recursive: true, force: true })
    }
}

function buildSyntheticRawReviewRows(runId, sourceId, pageIndex, reviewsPerPage) {
    const rows = []

    for (let index = 0; index < reviewsPerPage; index += 1) {
        const reviewIndex = pageIndex * reviewsPerPage + index + 1
        const ratingPattern = [5, 4, 3, 2, 1]
        const rating = ratingPattern[reviewIndex % ratingPattern.length]
        const reviewDate = new Date(Date.UTC(2026, 0, 1, 0, reviewIndex, 0))
        const sourceExternalId = `synthetic-${runId}-${pageIndex + 1}-${index + 1}`

        rows.push({
            sourceId,
            firstSeenRunId: runId,
            lastSeenRunId: runId,
            externalReviewKey: `google-maps:review:${sourceExternalId}`,
            providerReviewId: sourceExternalId,
            reviewUrl: `https://example.invalid/reviews/${sourceExternalId}`,
            authorName: `Synthetic Worker Reviewer ${reviewIndex}`,
            rating,
            content: `Synthetic worker load review ${reviewIndex} for run ${runId}.`,
            reviewDate,
            language: 'en',
            ownerResponseText: null,
            validForIntake: true,
            validationIssues: null,
            intakeItemPayload: {
                sourceProvider: 'GOOGLE_MAPS',
                sourceExternalId: `google-maps:review:${sourceExternalId}`,
                rawAuthorName: `Synthetic Worker Reviewer ${reviewIndex}`,
                rawRating: rating,
                rawContent: `Synthetic worker load review ${reviewIndex} for run ${runId}.`,
                rawReviewDate: reviewDate.toISOString(),
            },
            payload: {
                reviewId: sourceExternalId,
                pageIndex: pageIndex + 1,
                index: reviewIndex,
            },
        })
    }

    return rows
}

function createSyntheticProcessor({
    prisma,
    pagesPerRun,
    reviewsPerPage,
    stepMs,
    queueMode,
}) {
    return async function syntheticProcessReviewCrawlRun(runId, job) {
        const existingRun = await prisma.reviewCrawlRun.findUnique({
            where: { id: runId },
            select: {
                id: true,
                sourceId: true,
            },
        })

        if (!existingRun) {
            throw new Error(`Run ${runId} was not found`)
        }

        const startedAt = new Date()

        await prisma.reviewCrawlRun.update({
            where: { id: runId },
            data: {
                status: 'RUNNING',
                startedAt,
                errorCode: null,
                errorMessage: null,
                leaseToken: `synthetic-${crypto.randomUUID()}`,
                leaseExpiresAt: new Date(Date.now() + 60 * 1000),
                metadataJson: {
                    syntheticWorkerLoad: true,
                    queueMode,
                    queueJobId: job?.id ?? null,
                },
            },
        })

        for (let pageIndex = 0; pageIndex < pagesPerRun; pageIndex += 1) {
            await sleep(stepMs)

            const now = new Date()
            const rows = buildSyntheticRawReviewRows(
                runId,
                existingRun.sourceId,
                pageIndex,
                reviewsPerPage,
            )
            const extractedCount = (pageIndex + 1) * reviewsPerPage

            await prisma.reviewCrawlRawReview.createMany({
                data: rows,
            })

            await prisma.reviewCrawlRun.update({
                where: { id: runId },
                data: {
                    reportedTotal: pagesPerRun * reviewsPerPage,
                    extractedCount,
                    validCount: extractedCount,
                    skippedCount: 0,
                    duplicateCount: 0,
                    warningCount: 0,
                    pagesFetched: pageIndex + 1,
                    checkpointCursor:
                        pageIndex === pagesPerRun - 1
                            ? null
                            : `synthetic-page-${pageIndex + 1}`,
                    knownReviewStreak: 0,
                    lastCheckpointAt: now,
                    metadataJson: {
                        syntheticWorkerLoad: true,
                        queueMode,
                        queueJobId: job?.id ?? null,
                        lastSyntheticPage: pageIndex + 1,
                    },
                },
            })
        }

        const finishedAt = new Date()

        await prisma.$transaction([
            prisma.reviewCrawlRun.update({
                where: { id: runId },
                data: {
                    status: 'COMPLETED',
                    reportedTotal: pagesPerRun * reviewsPerPage,
                    extractedCount: pagesPerRun * reviewsPerPage,
                    validCount: pagesPerRun * reviewsPerPage,
                    skippedCount: 0,
                    duplicateCount: 0,
                    warningCount: 0,
                    pagesFetched: pagesPerRun,
                    checkpointCursor: null,
                    finishedAt,
                    leaseToken: null,
                    leaseExpiresAt: null,
                    metadataJson: {
                        syntheticWorkerLoad: true,
                        queueMode,
                        queueJobId: job?.id ?? null,
                        pagesPerRun,
                        reviewsPerPage,
                    },
                },
            }),
            prisma.reviewCrawlSource.update({
                where: { id: existingRun.sourceId },
                data: {
                    lastReportedTotal: pagesPerRun * reviewsPerPage,
                    lastSyncedAt: finishedAt,
                    lastSuccessfulRunAt: finishedAt,
                },
            }),
        ])

        return {
            syntheticWorkerLoad: true,
            pagesPerRun,
            reviewsPerPage,
        }
    }
}

async function createSyntheticSources(prisma, restaurantId, sourceCount) {
    const now = new Date()
    const data = Array.from({ length: sourceCount }, (_, index) => ({
        restaurantId,
        provider: 'GOOGLE_MAPS',
        status: 'ACTIVE',
        inputUrl: `sentify://load/review-crawl/${index + 1}`,
        resolvedUrl: `sentify://load/review-crawl/${index + 1}`,
        canonicalCid: `load-source-${String(index + 1).padStart(4, '0')}`,
        placeHexId: `0xload${String(index + 1).padStart(4, '0')}`,
        googlePlaceId: `load-place-${String(index + 1).padStart(4, '0')}`,
        placeName: `Synthetic Load Source ${index + 1}`,
        language: 'en',
        region: 'us',
        syncEnabled: false,
        syncIntervalMinutes: 1440,
        lastReportedTotal: 0,
        nextScheduledAt: null,
        createdAt: now,
        updatedAt: now,
    }))

    await prisma.reviewCrawlSource.createMany({
        data,
    })

    return prisma.reviewCrawlSource.findMany({
        where: {
            restaurantId,
            canonicalCid: {
                startsWith: 'load-source-',
            },
        },
        orderBy: {
            canonicalCid: 'asc',
        },
    })
}

async function createSyntheticRuns({
    prisma,
    sources,
    operatorUserId,
    pagesPerRun,
    reviewsPerPage,
    queueMode,
}) {
    const createdRuns = []

    for (const source of sources) {
        createdRuns.push(
            await prisma.reviewCrawlRun.create({
                data: {
                    sourceId: source.id,
                    restaurantId: source.restaurantId,
                    requestedByUserId: operatorUserId,
                    strategy: 'BACKFILL',
                    priority: 'NORMAL',
                    status: 'QUEUED',
                    pageSize: reviewsPerPage,
                    delayMs: 0,
                    maxPages: pagesPerRun,
                    maxReviews: pagesPerRun * reviewsPerPage,
                    queuedAt: new Date(),
                    metadataJson: {
                        syntheticWorkerLoad: true,
                        queueMode,
                        trigger: 'load-proof',
                    },
                },
            }),
        )
    }

    return createdRuns
}

function isTerminalStatus(status) {
    return ['COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED'].includes(status)
}

async function waitForRunsToFinish(prisma, runIds, sampleMs) {
    const samples = []

    while (true) {
        const runs = await prisma.reviewCrawlRun.findMany({
            where: {
                id: {
                    in: runIds,
                },
            },
            select: {
                id: true,
                status: true,
            },
        })
        const runningCount = runs.filter((run) => run.status === 'RUNNING').length
        const queuedCount = runs.filter((run) => run.status === 'QUEUED').length
        const terminalCount = runs.filter((run) => isTerminalStatus(run.status)).length

        samples.push({
            runningCount,
            queuedCount,
            terminalCount,
        })

        if (runs.length === runIds.length && runs.every((run) => isTerminalStatus(run.status))) {
            return samples
        }

        await sleep(sampleMs)
    }
}

async function runInlinePool(processor, runIds, concurrency) {
    let cursor = 0

    async function workerLoop(workerIndex) {
        while (true) {
            const current = cursor
            cursor += 1

            if (current >= runIds.length) {
                return
            }

            const runId = runIds[current]
            await processor(runId, {
                id: `inline-${workerIndex}-${current + 1}`,
                name: 'process-run',
                data: { runId },
            })
        }
    }

    await Promise.all(
        Array.from({ length: concurrency }, (_, index) => workerLoop(index + 1)),
    )
}

async function main() {
    const args = process.argv.slice(2)

    if (args.includes('--help')) {
        printUsage()
        return
    }

    const options = {
        sourceCount: parsePositiveInt(readFlag(args, '--source-count'), 24),
        concurrency: parsePositiveInt(readFlag(args, '--concurrency'), 4),
        pagesPerRun: parsePositiveInt(readFlag(args, '--pages-per-run'), 12),
        reviewsPerPage: parsePositiveInt(readFlag(args, '--reviews-per-page'), 20),
        stepMs: parsePositiveInt(readFlag(args, '--step-ms'), 40),
        sampleMs: parsePositiveInt(readFlag(args, '--sample-ms'), 100),
        queueName:
            readFlag(args, '--queue-name') ||
            `review-crawl-load-${process.pid}-${Date.now()}`,
        forceLocalRedis: args.includes('--force-local-redis'),
        forceInline: args.includes('--force-inline'),
        skipBaselineReset: args.includes('--skip-baseline-reset'),
        output: readFlag(args, '--output'),
    }

    process.env.NODE_ENV = 'development'
    process.env.LOG_FORMAT = process.env.LOG_FORMAT || 'json'
    process.env.JWT_SECRET =
        process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
    process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'sentify-api'
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'sentify-web'
    process.env.REVIEW_CRAWL_RUNTIME_MODE = 'processor'
    process.env.REVIEW_CRAWL_WORKER_CONCURRENCY = String(options.concurrency)
    process.env.REVIEW_CRAWL_QUEUE_NAME = options.queueName

    if (!options.skipBaselineReset) {
        runResetBaseline()
    }

    const redisState = await startLocalRedisIfNeeded({
        forceLocalRedis: options.forceLocalRedis,
        forceInline: options.forceInline,
    })
    const queueMode = redisState.mode

    const prisma = require('../src/lib/prisma')
    const { seedDemoData } = require('../prisma/seed-data')
    const reviewCrawlService = require('../src/modules/review-crawl/review-crawl.service')
    const {
        closeReviewCrawlQueueResources,
        getRedisConnection,
        getReviewCrawlQueueHealth,
    } = require('../src/modules/review-crawl/review-crawl.queue')
    const {
        readReviewCrawlWorkerHealth,
    } = require('../src/modules/review-crawl/review-crawl.runtime')
    const {
        startReviewCrawlWorkerRuntime,
    } = require('../src/modules/review-crawl/review-crawl.worker-runtime')

    const originalProcessReviewCrawlRun = reviewCrawlService.processReviewCrawlRun
    const syntheticProcessor = createSyntheticProcessor({
        prisma,
        pagesPerRun: options.pagesPerRun,
        reviewsPerPage: options.reviewsPerPage,
        stepMs: options.stepMs,
        queueMode,
    })
    reviewCrawlService.processReviewCrawlRun = syntheticProcessor

    let runtime = null

    try {
        const seedSummary = await seedDemoData({ prisma })
        const operatorUserId = seedSummary.users.admin.id
        const restaurantId = seedSummary.restaurants.phoHong.id
        const sources = await createSyntheticSources(
            prisma,
            restaurantId,
            options.sourceCount,
        )

        if (queueMode === 'redis') {
            runtime = await startReviewCrawlWorkerRuntime({
                runtimeMode: 'processor',
                scheduleOnStart: false,
                scheduleImmediately: false,
            })
        }

        const enqueueStartedAt = performance.now()
        const runs =
            queueMode === 'inline'
                ? await createSyntheticRuns({
                      prisma,
                      sources,
                      operatorUserId,
                      pagesPerRun: options.pagesPerRun,
                      reviewsPerPage: options.reviewsPerPage,
                      queueMode,
                  })
                : await Promise.all(
                      sources.map((source) =>
                          reviewCrawlService.createReviewCrawlRun({
                              userId: operatorUserId,
                              sourceId: source.id,
                              input: {
                                  strategy: 'BACKFILL',
                                  pageSize: options.reviewsPerPage,
                                  maxPages: options.pagesPerRun,
                                  maxReviews:
                                      options.pagesPerRun * options.reviewsPerPage,
                                  delayMs: 0,
                              },
                              trigger: 'load-proof',
                              metadata: {
                                  syntheticWorkerLoad: true,
                                  queueMode,
                              },
                          }),
                      ),
                  )
        const enqueueDurationMs = round(performance.now() - enqueueStartedAt, 2)
        const runIds = runs.map((run) => run.id)

        const waitPromise = waitForRunsToFinish(prisma, runIds, options.sampleMs)
        const makespanStartedAt = performance.now()

        if (queueMode === 'redis') {
            await waitPromise
        } else {
            await runInlinePool(syntheticProcessor, runIds, options.concurrency)
        }

        const samples = await waitPromise
        const makespanMs = round(performance.now() - makespanStartedAt, 2)
        const finalRuns = await prisma.reviewCrawlRun.findMany({
            where: {
                id: {
                    in: runIds,
                },
            },
            orderBy: {
                queuedAt: 'asc',
            },
            select: {
                id: true,
                sourceId: true,
                status: true,
                queuedAt: true,
                startedAt: true,
                finishedAt: true,
                extractedCount: true,
                pagesFetched: true,
                warningCount: true,
            },
        })
        const totalRawReviews = await prisma.reviewCrawlRawReview.count({
            where: {
                sourceId: {
                    in: sources.map((source) => source.id),
                },
            },
        })
        const queueWaitMs = finalRuns
            .map((run) =>
                run.startedAt && run.queuedAt
                    ? run.startedAt.getTime() - run.queuedAt.getTime()
                    : null,
            )
            .filter((value) => value !== null)
        const processingMs = finalRuns
            .map((run) =>
                run.finishedAt && run.startedAt
                    ? run.finishedAt.getTime() - run.startedAt.getTime()
                    : null,
            )
            .filter((value) => value !== null)
        const totalRunMs = finalRuns
            .map((run) =>
                run.finishedAt && run.queuedAt
                    ? run.finishedAt.getTime() - run.queuedAt.getTime()
                    : null,
            )
            .filter((value) => value !== null)
        const maxRunningObserved =
            samples.length > 0
                ? Math.max(...samples.map((sample) => sample.runningCount))
                : 0
        const averageRunningObserved =
            samples.length > 0
                ? round(
                      samples.reduce((sum, sample) => sum + sample.runningCount, 0) /
                          samples.length,
                      2,
                    )
                : 0
        const runRawReviewsPerSecond = finalRuns.map((run) =>
            run.finishedAt && run.queuedAt && run.extractedCount
                ? round(
                      run.extractedCount /
                          ((run.finishedAt.getTime() - run.queuedAt.getTime()) / 1000),
                      2,
                  )
                : null,
        )
        const queueHealth = await getReviewCrawlQueueHealth()
        const workerHealth =
            queueMode === 'redis'
                ? await readReviewCrawlWorkerHealth(getRedisConnection())
                : {
                      configured: false,
                      scheduler: null,
                      processors: [],
                  }

        const report = {
            generatedAt: new Date().toISOString(),
            queueMode,
            configuration: {
                sourceCount: options.sourceCount,
                concurrency: options.concurrency,
                pagesPerRun: options.pagesPerRun,
                reviewsPerPage: options.reviewsPerPage,
                stepMs: options.stepMs,
                sampleMs: options.sampleMs,
                queueName: options.queueName,
                baselineReset: !options.skipBaselineReset,
            },
            execution: {
                enqueueDurationMs,
                makespanMs,
                syntheticRawReviewsPersisted: totalRawReviews,
                runsPerSecond: round(finalRuns.length / (makespanMs / 1000), 2),
                pagesPerSecond: round(
                    (finalRuns.length * options.pagesPerRun) / (makespanMs / 1000),
                    2,
                ),
                rawReviewsPerSecond: round(totalRawReviews / (makespanMs / 1000), 2),
            },
            observedConcurrency: {
                maxRunningObserved,
                averageRunningObserved,
                sampleCount: samples.length,
                utilizationProxy: summarizeUtilizationProxy({
                    configuredConcurrency: options.concurrency,
                    averageObserved: averageRunningObserved,
                    maxObserved: maxRunningObserved,
                    sampleCount: samples.length,
                }),
            },
            latencyMs: {
                queueWait: summarizeLatencySeries(queueWaitMs),
                processing: summarizeLatencySeries(processingMs),
                totalRun: summarizeLatencySeries(totalRunMs),
            },
            throughputPerRun: {
                rawReviewsPerSecond: summarizeNumericSeries(
                    runRawReviewsPerSecond.filter((value) => typeof value === 'number'),
                ),
            },
            statusSummary: finalRuns.reduce((summary, run) => {
                summary[run.status] = (summary[run.status] || 0) + 1
                return summary
            }, {}),
            runs: finalRuns.map((run) => ({
                id: run.id,
                sourceId: run.sourceId,
                status: run.status,
                extractedCount: run.extractedCount,
                pagesFetched: run.pagesFetched,
                warningCount: run.warningCount,
                queueWaitMs:
                    run.startedAt && run.queuedAt
                        ? run.startedAt.getTime() - run.queuedAt.getTime()
                        : null,
                processingMs:
                    run.finishedAt && run.startedAt
                        ? run.finishedAt.getTime() - run.startedAt.getTime()
                        : null,
                totalRunMs:
                    run.finishedAt && run.queuedAt
                        ? run.finishedAt.getTime() - run.queuedAt.getTime()
                        : null,
            })),
            queueHealth,
            workerHealth,
            notes: [
                'This harness queues real ReviewCrawlRun rows and persists synthetic ReviewCrawlRawReview checkpoints page-by-page, so database write pressure is real.',
                queueMode === 'redis'
                    ? `Redis was available, so BullMQ transport and the real worker runtime were exercised on the isolated queue ${options.queueName}.`
                    : 'Redis was not available, so the harness fell back to inline queue mode and an in-process worker pool. This proves local worker orchestration and checkpoint pressure, but not Redis transport behavior.',
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
        reviewCrawlService.processReviewCrawlRun = originalProcessReviewCrawlRun

        if (runtime) {
            await runtime.stop()
        }

        await closeReviewCrawlQueueResources()

        if (typeof prisma.disconnect === 'function') {
            await prisma.disconnect()
        } else if (typeof prisma.$disconnect === 'function') {
            await prisma.$disconnect()
        }

        await stopLocalRedis(redisState)
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exit(1)
})
