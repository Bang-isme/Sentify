#!/usr/bin/env node

require('dotenv').config()

const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

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

function parseOptionalInt(value) {
    if (value === undefined || value === null || value === '') {
        return undefined
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? value : parsed
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/review-ops-sync-draft-smoke.js --url <google-maps-url> [options]',
            '',
            'Options:',
            '  --restaurant-id <uuid>    Optional. Defaults to the first restaurant in the dataset',
            '  --user-id <uuid>          Optional. Defaults to the first ADMIN user',
            '  --language <code>         Default: en',
            '  --region <code>           Default: us',
            '  --strategy <value>        Optional override: incremental | backfill',
            '  --page-size <n>           Optional page size override',
            '  --max-pages <n>           Optional page cap',
            '  --max-reviews <n>         Optional review cap',
            '  --delay-ms <n>            Optional delay between pages override',
            '  --timeout-ms <n>          Poll timeout for the run, default: 600000',
            '  --poll-ms <n>             Poll interval, default: 1000',
            '  --settle-ms <n>           Stable terminal window, default: 5000',
            '  --output <file>           Write the smoke summary JSON to a file',
            '',
            'Redis:',
            '  If REDIS_URL is not set, the script will try a local redis-server or memurai',
            '  binary from PATH or REVIEW_CRAWL_REDIS_BINARY. If neither is available,',
            '  the script falls back to inline queue mode for local benchmarking only.',
        ].join('\n'),
    )
}

function wait(ms) {
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
    } catch (error) {
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
        } catch (error) {
            await wait(250)
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

async function startLocalRedisIfNeeded() {
    if (process.env.REDIS_URL) {
        return {
            redisUrl: process.env.REDIS_URL,
            child: null,
            tempDir: null,
            startedEmbeddedRedis: false,
            inlineQueueMode: false,
        }
    }

    const binary = resolveRedisBinary()

    if (!binary) {
        process.env.REVIEW_CRAWL_INLINE_QUEUE_MODE = 'true'

        return {
            redisUrl: null,
            child: null,
            tempDir: null,
            startedEmbeddedRedis: false,
            inlineQueueMode: true,
        }
    }

    const port = await getFreePort()
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'sentify-review-ops-sync-redis-'),
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
        redisUrl,
        child,
        tempDir,
        startedEmbeddedRedis: true,
        inlineQueueMode: false,
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
    await Promise.race([exitPromise, wait(5000)])

    if (!exited) {
        child.kill('SIGKILL')
    }

    if (state.tempDir) {
        fs.rmSync(state.tempDir, { recursive: true, force: true })
    }
}

async function resolveInternalOperatorContext(prisma, explicitUserId, explicitRestaurantId) {
    const [operatorUser, restaurant] = await Promise.all([
        explicitUserId
            ? prisma.user.findUnique({
                  where: {
                      id: explicitUserId,
                  },
                  select: {
                      id: true,
                      role: true,
                  },
              })
            : prisma.user.findFirst({
                  where: {
                      role: {
                          in: ['ADMIN'],
                      },
                  },
                  orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
                  select: {
                      id: true,
                      role: true,
                  },
              }),
        explicitRestaurantId
            ? prisma.restaurant.findUnique({
                  where: {
                      id: explicitRestaurantId,
                  },
                  select: {
                      id: true,
                  },
              })
            : prisma.restaurant.findFirst({
                  orderBy: {
                      createdAt: 'asc',
                  },
                  select: {
                      id: true,
                  },
              }),
    ])

    if (!operatorUser) {
        throw new Error(
            'No internal ADMIN user was found. Pass --user-id explicitly or seed an operator user first.',
        )
    }

    if (!['ADMIN'].includes(operatorUser.role)) {
        throw new Error('The selected --user-id does not belong to an internal ADMIN user.')
    }

    if (!restaurant) {
        throw new Error(
            'No restaurant was found. Pass --restaurant-id explicitly or seed a restaurant first.',
        )
    }

    return {
        userId: operatorUser.id,
        userRole: operatorUser.role,
        restaurantId: restaurant.id,
    }
}

function snapshotRun(run) {
    return {
        status: run.status,
        updatedAt: run.updatedAt,
        extractedCount: run.extractedCount,
        validCount: run.validCount,
        pagesFetched: run.pagesFetched,
        warningCount: run.warningCount,
        intakeBatchId: run.intakeBatchId ?? run.intakeBatch?.id ?? null,
        autoResumeChainCount: run.metadata?.autoResumeChainCount ?? 0,
        stopReason: run.metadata?.stopReason ?? null,
    }
}

async function readJobState(runId) {
    const { getReviewCrawlJob } = require('../src/modules/review-crawl/review-crawl.queue')
    const job = await getReviewCrawlJob(runId)

    if (!job) {
        return null
    }

    try {
        return await job.getState()
    } catch {
        return null
    }
}

function isTerminalStatus(status) {
    return ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(status)
}

async function waitForStableTerminalRun(
    service,
    userId,
    runId,
    timeoutMs,
    pollMs,
    settleMs,
) {
    const startedAt = Date.now()
    let lastStableTerminalSnapshot = null
    let lastStableTerminalSeenAt = 0

    while (Date.now() - startedAt < timeoutMs) {
        const run = await service.getReviewCrawlRun({
            userId,
            runId,
        })

        if (!isTerminalStatus(run.status)) {
            lastStableTerminalSnapshot = null
            lastStableTerminalSeenAt = 0
            await wait(pollMs)
            continue
        }

        const jobState = await readJobState(runId)
        const currentSnapshot = snapshotRun(run)

        if (jobState && !['completed', 'failed', 'unknown'].includes(jobState)) {
            lastStableTerminalSnapshot = null
            lastStableTerminalSeenAt = 0
            await wait(pollMs)
            continue
        }

        if (
            lastStableTerminalSnapshot &&
            JSON.stringify(lastStableTerminalSnapshot) === JSON.stringify(currentSnapshot)
        ) {
            if (Date.now() - lastStableTerminalSeenAt >= settleMs) {
                return {
                    run,
                    terminalSnapshot: currentSnapshot,
                    totalWallClockMs: Date.now() - startedAt,
                }
            }
        } else {
            lastStableTerminalSnapshot = currentSnapshot
            lastStableTerminalSeenAt = Date.now()
        }

        await wait(pollMs)
    }

    throw new Error(`Timed out waiting for crawl run ${runId} to settle`)
}

async function processRunInlineUntilStable(
    service,
    userId,
    runId,
    timeoutMs,
    pollMs,
    settleMs,
) {
    const startedAt = Date.now()
    let lastTerminalSnapshot = null
    let lastTerminalSeenAt = 0

    while (Date.now() - startedAt < timeoutMs) {
        let run = await service.getReviewCrawlRun({
            userId,
            runId,
        })

        if (run.status === 'QUEUED') {
            await service.processReviewCrawlRun(runId)
            run = await service.getReviewCrawlRun({
                userId,
                runId,
            })
        }

        if (!isTerminalStatus(run.status)) {
            lastTerminalSnapshot = null
            lastTerminalSeenAt = 0
            await wait(pollMs)
            continue
        }

        const currentSnapshot = snapshotRun(run)

        if (
            lastTerminalSnapshot &&
            JSON.stringify(lastTerminalSnapshot) === JSON.stringify(currentSnapshot)
        ) {
            if (Date.now() - lastTerminalSeenAt >= settleMs) {
                return {
                    run,
                    terminalSnapshot: currentSnapshot,
                    totalWallClockMs: Date.now() - startedAt,
                }
            }
        } else {
            lastTerminalSnapshot = currentSnapshot
            lastTerminalSeenAt = Date.now()
        }

        await wait(pollMs)
    }

    throw new Error(`Timed out waiting for inline crawl run ${runId} to settle`)
}

async function main() {
    const args = process.argv.slice(2)
    const url = readFlag(args, '--url')

    if (!url) {
        printUsage()
        process.exit(1)
    }

    const redisState = await startLocalRedisIfNeeded()
    const prisma = require('../src/lib/prisma')
    const { startReviewCrawlWorkerRuntime } = require('../src/modules/review-crawl/review-crawl.worker-runtime')
    const reviewCrawlService = require('../src/modules/review-crawl/review-crawl.service')
    const reviewOpsService = require('../src/modules/review-ops/review-ops.service')

    const runtime = redisState.inlineQueueMode
        ? null
        : await startReviewCrawlWorkerRuntime()

    try {
        const operatorContext = await resolveInternalOperatorContext(
            prisma,
            readFlag(args, '--user-id'),
            readFlag(args, '--restaurant-id'),
        )

        const strategyOverrideRaw = readFlag(args, '--strategy')
        const strategyOverride = strategyOverrideRaw
            ? strategyOverrideRaw.toUpperCase()
            : null
        const syncResult = await reviewOpsService.syncGoogleMapsToDraft({
            userId: operatorContext.userId,
            input: {
                restaurantId: operatorContext.restaurantId,
                url,
                language: readFlag(args, '--language') || 'en',
                region: readFlag(args, '--region') || 'us',
                ...(strategyOverride ? { strategy: strategyOverride } : {}),
                ...(readFlag(args, '--page-size')
                    ? { pageSize: parseOptionalInt(readFlag(args, '--page-size')) }
                    : {}),
                ...(readFlag(args, '--max-pages')
                    ? { maxPages: parseOptionalInt(readFlag(args, '--max-pages')) }
                    : {}),
                ...(readFlag(args, '--max-reviews')
                    ? { maxReviews: parseOptionalInt(readFlag(args, '--max-reviews')) }
                    : {}),
                ...(readFlag(args, '--delay-ms')
                    ? { delayMs: parseOptionalInt(readFlag(args, '--delay-ms')) }
                    : {}),
            },
        })

        const timeoutMs = Number(readFlag(args, '--timeout-ms') || 10 * 60 * 1000)
        const pollMs = Number(readFlag(args, '--poll-ms') || 1000)
        const settleMs = Number(readFlag(args, '--settle-ms') || 5000)
        const terminalResult = redisState.inlineQueueMode
            ? await processRunInlineUntilStable(
                  reviewCrawlService,
                  operatorContext.userId,
                  syncResult.run.id,
                  timeoutMs,
                  pollMs,
                  settleMs,
              )
            : await waitForStableTerminalRun(
                  reviewCrawlService,
                  operatorContext.userId,
                  syncResult.run.id,
                  timeoutMs,
                  pollMs,
                  settleMs,
              )

        const terminalRun = terminalResult.run
        const batchId = terminalRun.intakeBatch?.id || terminalRun.intakeBatchId || null
        let batchReadiness = null

        if (batchId) {
            batchReadiness = await reviewOpsService.getBatchReadiness({
                userId: operatorContext.userId,
                batchId,
            })
        }

        const payload = {
            redis: {
                url: redisState.redisUrl,
                startedEmbeddedRedis: redisState.startedEmbeddedRedis,
                inlineQueueMode: redisState.inlineQueueMode,
            },
            operatorContext,
            request: {
                url,
                language: readFlag(args, '--language') || 'en',
                region: readFlag(args, '--region') || 'us',
                strategyOverride,
            },
            syncResult: {
                sourceId: syncResult.source.id,
                runId: syncResult.run.id,
                initialRunStatus: syncResult.run.status,
                initialRunStrategy: syncResult.run.strategy,
                draftPolicy: syncResult.draftPolicy,
            },
            source: syncResult.source,
            run: terminalRun,
            draftBatch: batchId
                ? {
                      id: batchId,
                      status: terminalRun.intakeBatch?.status || null,
                      title: terminalRun.intakeBatch?.title || null,
                  }
                : null,
            batchReadiness,
            benchmark: {
                totalWallClockMs: terminalResult.totalWallClockMs,
                terminalSnapshot: terminalResult.terminalSnapshot,
            },
            notes: [
                'This smoke harness exercises the review-ops sync-to-draft entrypoint instead of creating a crawl run directly.',
                redisState.inlineQueueMode
                    ? 'Redis was unavailable, so the script fell back to inline queue mode and cannot be used as BullMQ transport proof.'
                    : 'Redis was available, so the operator-triggered path used the real BullMQ queue transport and worker runtime.',
            ],
        }

        const outputPath = readFlag(args, '--output')
        const text = `${JSON.stringify(payload, null, 2)}\n`

        if (outputPath) {
            const resolvedOutputPath = path.resolve(outputPath)
            fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
            fs.writeFileSync(resolvedOutputPath, text, 'utf8')
            process.stdout.write(`${resolvedOutputPath}\n`)
        } else {
            process.stdout.write(text)
        }
    } finally {
        if (runtime) {
            await runtime.stop()
        }
        await prisma.disconnect()
        await stopLocalRedis(redisState)
    }
}

main().catch(async (error) => {
    console.error(error?.stack || error?.message || String(error))

    try {
        const prisma = require('../src/lib/prisma')
        await prisma.disconnect()
    } catch (disconnectError) {
        console.error(disconnectError?.stack || disconnectError?.message || String(disconnectError))
    }

    process.exit(1)
})

