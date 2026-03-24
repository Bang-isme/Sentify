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

function hasFlag(args, name) {
    return args.includes(name)
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
            '  node scripts/review-crawl-queue-smoke.js --url <google-maps-url> [options]',
            '',
            'Options:',
            '  --restaurant-id <uuid>    Optional. Defaults to the first OWNER membership',
            '  --user-id <uuid>          Optional. Defaults to the first OWNER membership user',
            '  --language <code>         Default: en',
            '  --region <code>           Default: us',
            '  --strategy <value>        incremental | backfill (default: backfill)',
            '  --page-size <n>           Default: 20',
            '  --max-pages <n>           Optional page cap',
            '  --max-reviews <n>         Optional review cap',
            '  --delay-ms <n>            Delay between pages, default: 250',
            '  --timeout-ms <n>          Poll timeout for the run, default: 600000',
            '  --poll-ms <n>             Poll interval, default: 1000',
            '  --materialize             Materialize completed run into a draft intake batch',
            '  --output <file>           Write the smoke summary JSON to a file',
            '',
            'Redis:',
            '  If REDIS_URL is not set, the script will try a local redis-server or memurai',
            '  binary from PATH or common Chocolatey locations.',
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
        }
    }

    const binary = resolveRedisBinary()

    if (!binary) {
        throw new Error(
            'REDIS_URL is missing and no local redis-server or memurai binary was found',
        )
    }

    const port = await getFreePort()
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'sentify-review-crawl-redis-'),
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

async function resolveOwnerContext(prisma, explicitUserId, explicitRestaurantId) {
    if (explicitUserId && explicitRestaurantId) {
        return {
            userId: explicitUserId,
            restaurantId: explicitRestaurantId,
        }
    }

    const ownerMembership = await prisma.restaurantUser.findFirst({
        where: {
            permission: 'OWNER',
        },
        select: {
            userId: true,
            restaurantId: true,
        },
    })

    if (!ownerMembership) {
        throw new Error(
            'No OWNER restaurant membership was found. Pass --user-id and --restaurant-id explicitly.',
        )
    }

    return {
        userId: explicitUserId || ownerMembership.userId,
        restaurantId: explicitRestaurantId || ownerMembership.restaurantId,
    }
}

async function waitForTerminalRun(service, userId, runId, timeoutMs, pollMs) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        const run = await service.getReviewCrawlRun({
            userId,
            runId,
        })

        if (['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(run.status)) {
            return run
        }

        await wait(pollMs)
    }

    throw new Error(`Timed out waiting for crawl run ${runId} to settle`)
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
    const service = require('../src/modules/review-crawl/review-crawl.service')

    const runtime = await startReviewCrawlWorkerRuntime()

    try {
        const ownerContext = await resolveOwnerContext(
            prisma,
            readFlag(args, '--user-id'),
            readFlag(args, '--restaurant-id'),
        )

        const sourceResult = await service.upsertReviewCrawlSource({
            userId: ownerContext.userId,
            input: {
                restaurantId: ownerContext.restaurantId,
                url,
                language: readFlag(args, '--language') || 'en',
                region: readFlag(args, '--region') || 'us',
            },
        })

        const runResult = await service.createReviewCrawlRun({
            userId: ownerContext.userId,
            sourceId: sourceResult.source.id,
            input: {
                strategy: (readFlag(args, '--strategy') || 'backfill').toUpperCase(),
                pageSize: parseOptionalInt(readFlag(args, '--page-size')),
                maxPages: parseOptionalInt(readFlag(args, '--max-pages')),
                maxReviews: parseOptionalInt(readFlag(args, '--max-reviews')),
                delayMs: parseOptionalInt(readFlag(args, '--delay-ms')),
            },
        })

        const terminalRun = await waitForTerminalRun(
            service,
            ownerContext.userId,
            runResult.id,
            Number(readFlag(args, '--timeout-ms') || 10 * 60 * 1000),
            Number(readFlag(args, '--poll-ms') || 1000),
        )

        let materialization = null

        if (
            hasFlag(args, '--materialize') &&
            ['COMPLETED', 'PARTIAL'].includes(terminalRun.status)
        ) {
            materialization = await service.materializeRunToIntake({
                userId: ownerContext.userId,
                runId: terminalRun.id,
            })
        }

        const payload = {
            redis: {
                url: redisState.redisUrl,
                startedEmbeddedRedis: redisState.startedEmbeddedRedis,
            },
            ownerContext,
            source: sourceResult.source,
            run: terminalRun,
            materialization: materialization
                ? {
                      batchId: materialization.batch.id,
                      batchStatus: materialization.batch.status,
                      materializedCount: materialization.materializedCount,
                  }
                : null,
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
        await runtime.stop()
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
