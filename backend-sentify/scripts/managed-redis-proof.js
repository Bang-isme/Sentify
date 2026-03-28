#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { loadEnvFiles } = require('./load-env-files')

const IORedis = require('ioredis')
const { Queue, Worker } = require('bullmq')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'managed-redis-proof.json',
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

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/managed-redis-proof.js [options]',
            '',
            'Options:',
            '  --redis-url <url>         Managed Redis URL override (falls back to RELEASE_EVIDENCE_MANAGED_REDIS_URL or REDIS_URL)',
            '  --queue-name <name>       Optional ephemeral BullMQ queue name',
            '  --timeout-ms <ms>         Completion timeout in milliseconds (default: 20000)',
            `  --output <file>           Write the proof report JSON (default: ${DEFAULT_OUTPUT_PATH})`,
            '  --help                    Show this help message',
        ].join('\n'),
    )
}

function redactRedisUrl(redisUrl) {
    try {
        const parsed = new URL(redisUrl)

        if (parsed.password) {
            parsed['password'] = '***'
        }

        if (parsed.username) {
            parsed['username'] = parsed.username
        }

        return parsed.toString()
    } catch (error) {
        return redisUrl
    }
}

function normalizeForDigest(value) {
    if (value instanceof Date) {
        return value.toISOString()
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeForDigest(item))
    }

    if (value && typeof value === 'object') {
        const normalized = {}

        for (const key of Object.keys(value).sort()) {
            normalized[key] = normalizeForDigest(value[key])
        }

        return normalized
    }

    return value
}

function parseRedisInfoBlock(info) {
    const parsed = {}

    for (const line of info.split('\n')) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith('#')) {
            continue
        }

        const separatorIndex = trimmed.indexOf(':')
        if (separatorIndex === -1) {
            continue
        }

        const key = trimmed.slice(0, separatorIndex)
        const value = trimmed.slice(separatorIndex + 1)
        parsed[key] = value
    }

    return parsed
}

async function waitForJobToSettle(queue, jobId, timeoutMs) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        const job = await queue.getJob(jobId)

        if (!job) {
            throw new Error(`Probe job ${jobId} disappeared before completion`)
        }

        const state = await job.getState()

        if (state === 'completed') {
            return {
                state,
                returnValue: await job.returnvalue,
                finishedOn: job.finishedOn ?? null,
                processedOn: job.processedOn ?? null,
                attemptsMade: job.attemptsMade,
            }
        }

        if (state === 'failed') {
            throw new Error(`Probe job ${jobId} failed: ${job.failedReason || 'unknown error'}`)
        }

        await wait(250)
    }

    throw new Error(`Timed out waiting for managed Redis probe job ${jobId} to complete`)
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const redisUrl =
        readFlag(args, '--redis-url') ||
        process.env.RELEASE_EVIDENCE_MANAGED_REDIS_URL ||
        process.env.REDIS_URL

    if (!redisUrl) {
        throw new Error(
            'A Redis URL is required via --redis-url, RELEASE_EVIDENCE_MANAGED_REDIS_URL, or REDIS_URL',
        )
    }

    const timeoutMs = Number.parseInt(readFlag(args, '--timeout-ms') || '', 10) || 20000
    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const queueName =
        readFlag(args, '--queue-name') ||
        `release-evidence-managed-${Date.now()}-${process.pid}`
    const jobId = crypto.randomUUID
        ? `managed-proof-${crypto.randomUUID()}`
        : `managed-proof-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const startedAt = new Date()
    let commandConnection = null
    let queueConnection = null
    let workerConnection = null
    let queue = null
    let worker = null

    try {
        commandConnection = new IORedis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        })
        queueConnection = new IORedis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        })
        workerConnection = new IORedis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        })

        const [ping, serverInfo, clientsInfo] = await Promise.all([
            commandConnection.ping(),
            commandConnection.info('server'),
            commandConnection.info('clients'),
        ])

        queue = new Queue(queueName, {
            connection: queueConnection,
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 100,
            },
        })

        worker = new Worker(
            queueName,
            async (job) => ({
                jobId: job.id,
                processedAt: new Date().toISOString(),
            }),
            {
                connection: workerConnection,
                concurrency: 1,
            },
        )

        await worker.waitUntilReady()

        const enqueuedJob = await queue.add(
            'managed-redis-proof',
            {
                enqueuedAt: startedAt.toISOString(),
            },
            {
                jobId,
            },
        )

        const completion = await waitForJobToSettle(queue, enqueuedJob.id, timeoutMs)
        const jobCounts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
        )
        const finishedAt = new Date()
        const parsedServerInfo = parseRedisInfoBlock(serverInfo)
        const parsedClientsInfo = parseRedisInfoBlock(clientsInfo)

        const report = {
            benchmark: {
                startedAt,
                finishedAt,
                durationMs: finishedAt.getTime() - startedAt.getTime(),
                mode: 'managed_redis_bullmq_probe',
            },
            redis: {
                url: redactRedisUrl(redisUrl),
                ping,
                redisVersion: parsedServerInfo.redis_version || 'unknown',
                redisMode: parsedServerInfo.redis_mode || 'unknown',
                tcpPort: parsedServerInfo.tcp_port || 'unknown',
                connectedClients: parsedClientsInfo.connected_clients || 'unknown',
            },
            bullmq: {
                queueName,
                jobId: enqueuedJob.id,
                status: completion.state,
                processedOn: completion.processedOn,
                finishedOn: completion.finishedOn,
                attemptsMade: completion.attemptsMade,
                returnValue: completion.returnValue || null,
                countsAfterProbe: jobCounts,
            },
            result: {
                passed: completion.state === 'completed' && ping === 'PONG',
            },
            notes: [
                'This proof uses a dedicated ephemeral BullMQ queue and worker against the supplied Redis URL.',
                'A passing result proves Redis connectivity plus basic BullMQ enqueue/process/complete compatibility.',
                'Use a managed Redis URL here for release evidence; local Redis is still valid for script verification.',
            ],
        }

        const resolvedOutputPath = path.resolve(outputPath)
        fs.mkdirSync(path.dirname(resolvedOutputPath), {
            recursive: true,
        })
        fs.writeFileSync(
            resolvedOutputPath,
            `${JSON.stringify(normalizeForDigest(report), null, 2)}\n`,
        )

        process.stdout.write(
            `${JSON.stringify(
                {
                    queueName,
                    redisVersion: report.redis.redisVersion,
                    status: report.bullmq.status,
                    passed: report.result.passed,
                },
                null,
                2,
            )}\n`,
        )
        process.stdout.write(`Managed Redis proof report written to ${resolvedOutputPath}\n`)
    } finally {
        if (worker) {
            await worker.close()
        }

        if (queue) {
            try {
                await queue.obliterate({ force: true })
            } catch (error) {
                // Best-effort cleanup only.
            }
            await queue.close()
        }

        if (workerConnection) {
            await workerConnection.quit()
        }

        if (queueConnection) {
            await queueConnection.quit()
        }

        if (commandConnection) {
            await commandConnection.quit()
        }
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exitCode = 1
})
