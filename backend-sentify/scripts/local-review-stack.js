#!/usr/bin/env node

const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const IORedis = require('ioredis')
const dotenv = require('dotenv')

const rootDir = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(rootDir, '.env') })

const stackNamespace = process.env.REVIEW_CRAWL_STACK_NAMESPACE?.trim() || ''
const runtimeDir = stackNamespace
    ? path.join(rootDir, '.local-runtime', stackNamespace)
    : path.join(rootDir, '.local-runtime')
const stateFile = path.join(runtimeDir, 'review-crawl-stack.json')

const apiPort = Number(process.env.PORT || 3000)
const apiHost = '127.0.0.1'
const redisUrl = process.env.REDIS_URL || ''
const queueName = process.env.REVIEW_CRAWL_QUEUE_NAME || 'review-crawl'
const runtimeMode = process.env.REVIEW_CRAWL_RUNTIME_MODE || 'both'
const processorHeartbeatIndexKey = `${queueName}:health:processor:index`
const forceStop = process.env.REVIEW_CRAWL_FORCE_STOP === 'true'
const runtimeHealthTtlMs = Number(
    process.env.REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS || 90 * 1000,
)
const localHostname = os.hostname()

function ensureRuntimeDir() {
    fs.mkdirSync(runtimeDir, { recursive: true })
}

function readState() {
    if (!fs.existsSync(stateFile)) {
        return null
    }

    try {
        return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    } catch (error) {
        return {
            invalid: true,
            error: error.message,
        }
    }
}

function writeState(state) {
    ensureRuntimeDir()
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function removeStateFile() {
    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile)
    }
}

function isPidAlive(pid) {
    if (!pid) {
        return false
    }

    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

function parseRedisTarget(urlValue) {
    if (!urlValue) {
        throw new Error('REDIS_URL is required for the local review stack')
    }

    const parsed = new URL(urlValue)
    return {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        raw: urlValue,
    }
}

async function withRedis(urlValue, fn) {
    const redis = new IORedis(urlValue, {
        lazyConnect: true,
        connectTimeout: 1500,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        retryStrategy: null,
    })

    try {
        await redis.connect()
        return await fn(redis)
    } finally {
        try {
            await redis.quit()
        } catch {
            redis.disconnect()
        }
    }
}

function parseInfoValue(info, key) {
    const match = info.match(new RegExp(`^${key}:(.+)$`, 'm'))
    return match ? match[1].trim() : null
}

function parseVersionMajor(versionValue) {
    if (!versionValue) {
        return null
    }

    const match = versionValue.match(/(\d+)\./)
    return match ? Number(match[1]) : null
}

function parseHeartbeatTimestamp(updatedAt) {
    if (!updatedAt) {
        return null
    }

    const parsed = Date.parse(updatedAt)
    return Number.isNaN(parsed) ? null : parsed
}

function buildProcessorEntry(key, value) {
    let parsed = null

    try {
        parsed = JSON.parse(value)
    } catch {
        parsed = null
    }

    if (!parsed || typeof parsed !== 'object') {
        return {
            key,
            raw: value,
            hostname: null,
            pid: null,
            updatedAt: null,
            local: false,
            pidAlive: false,
            stale: true,
        }
    }

    const updatedAtMs = parseHeartbeatTimestamp(parsed.updatedAt)
    const local = parsed.hostname === localHostname
    const pidAlive = local && parsed.pid ? isPidAlive(parsed.pid) : false
    const staleByAge =
        updatedAtMs === null ? true : Date.now() - updatedAtMs > runtimeHealthTtlMs
    const stale = staleByAge || (local && parsed.pid ? !pidAlive : false)

    return {
        key,
        ...parsed,
        local,
        pidAlive,
        stale,
    }
}

function buildSchedulerEntry(value) {
    if (!value) {
        return null
    }

    try {
        const parsed = JSON.parse(value)
        const updatedAtMs = parseHeartbeatTimestamp(parsed.updatedAt)
        const stale =
            updatedAtMs === null ? true : Date.now() - updatedAtMs > runtimeHealthTtlMs

        return {
            ...parsed,
            stale,
        }
    } catch {
        return {
            raw: value,
            stale: true,
        }
    }
}

async function cleanupStaleWorkerHeartbeats(urlValue) {
    return withRedis(urlValue, async (redis) => {
        const processorKeys = (await redis.keys(`${queueName}:health:processor:*`)).filter(
            (key) => key !== processorHeartbeatIndexKey,
        )
        if (processorKeys.length === 0) {
            return {
                removedProcessorKeys: [],
                removedScheduler: false,
            }
        }

        const processorValues = await redis.mget(...processorKeys)
        const processors = processorKeys.map((key, index) =>
            buildProcessorEntry(key, processorValues[index]),
        )

        const staleProcessorKeys = processors.filter((entry) => entry.stale).map((entry) => entry.key)
        if (staleProcessorKeys.length > 0) {
            await redis.del(...staleProcessorKeys)
        }

        const schedulerKey = `${queueName}:health:scheduler`
        const schedulerEntry = buildSchedulerEntry(await redis.get(schedulerKey))
        const removedScheduler = Boolean(schedulerEntry?.stale)
        if (removedScheduler) {
            await redis.del(schedulerKey)
        }

        return {
            removedProcessorKeys: staleProcessorKeys,
            removedScheduler,
        }
    })
}

async function getRedisStatus(urlValue) {
    try {
        return await withRedis(urlValue, async (redis) => {
            const info = await redis.info('server')
            return {
                reachable: true,
                version: parseInfoValue(info, 'redis_version'),
                processId: Number(parseInfoValue(info, 'process_id') || 0) || null,
                edition: parseInfoValue(info, 'memurai_edition'),
                queueName,
            }
        })
    } catch (error) {
        return {
            reachable: false,
            error: error.message,
            queueName,
        }
    }
}

async function getWorkerHealth(urlValue) {
    return withRedis(urlValue, async (redis) => {
        const processorKeys = (await redis.keys(`${queueName}:health:processor:*`)).filter(
            (key) => key !== processorHeartbeatIndexKey,
        )
        const processorValues =
            processorKeys.length > 0 ? await redis.mget(...processorKeys) : []
        const schedulerValue = await redis.get(`${queueName}:health:scheduler`)

        const processors = processorKeys
            .map((key, index) => buildProcessorEntry(key, processorValues[index]))
            .filter(Boolean)
        const scheduler = buildSchedulerEntry(schedulerValue)

        return {
            processors,
            scheduler,
        }
    })
}

function getRuntimeExpectation() {
    return {
        processor: runtimeMode === 'processor' || runtimeMode === 'both',
        scheduler: runtimeMode === 'scheduler' || runtimeMode === 'both',
    }
}

function hasExpectedWorkerHeartbeats(health, expectation) {
    if (!health) {
        return false
    }

    const activeProcessors = (health.processors || []).filter((entry) => !entry.stale)
    const activeScheduler = health.scheduler && !health.scheduler.stale

    return (
        (!expectation.processor || activeProcessors.length > 0) &&
        (!expectation.scheduler || Boolean(activeScheduler))
    )
}

async function isApiHealthy() {
    return new Promise((resolve) => {
        const request = http.get(
            {
                host: apiHost,
                port: apiPort,
                path: '/health',
                timeout: 1500,
            },
            (response) => {
                response.resume()
                resolve(response.statusCode === 200)
            },
        )

        request.on('error', () => resolve(false))
        request.on('timeout', () => {
            request.destroy()
            resolve(false)
        })
    })
}

async function waitFor(predicate, timeoutMs, intervalMs, description) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        if (await predicate()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Timed out waiting for ${description}`)
}

function spawnDetachedProcess(command, args, options) {
    ensureRuntimeDir()

    const stdoutFd = fs.openSync(options.stdoutPath, 'a')
    const stderrFd = fs.openSync(options.stderrPath, 'a')

    const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', stdoutFd, stderrFd],
    })

    child.unref()
    return child
}

function getRedisBinaryCandidates() {
    const explicit = process.env.REVIEW_CRAWL_REDIS_BINARY
    const projectRoot = path.resolve(rootDir, '..')

    return [
        explicit,
        path.join(
            projectRoot,
            'Memurai-Developer-v4.1.2',
            'SourceDir',
            'Memurai',
            'memurai.exe',
        ),
        path.join(projectRoot, 'tools', 'redis-local', 'redis-server.exe'),
    ].filter(Boolean)
}

function readBinaryVersion(binaryPath) {
    const versionResult = spawnSync(binaryPath, ['--version'], {
        encoding: 'utf8',
        windowsHide: true,
    })

    const combinedOutput = `${versionResult.stdout || ''}\n${versionResult.stderr || ''}`
    const versionMatch =
        combinedOutput.match(/API v=(\d+\.\d+\.\d+)/) ||
        combinedOutput.match(/v=(\d+\.\d+\.\d+)/) ||
        combinedOutput.match(/redis_version:(\d+\.\d+\.\d+)/)

    return {
        output: combinedOutput.trim(),
        version: versionMatch ? versionMatch[1] : null,
        major: versionMatch ? parseVersionMajor(versionMatch[1]) : null,
    }
}

function resolveCompatibleRedisBinary() {
    for (const candidate of getRedisBinaryCandidates()) {
        if (!candidate || !fs.existsSync(candidate)) {
            continue
        }

        const versionInfo = readBinaryVersion(candidate)
        if ((versionInfo.major || 0) >= 5) {
            return {
                path: candidate,
                version: versionInfo.version,
            }
        }
    }

    return null
}

async function ensureRedisReady(existingState) {
    const target = parseRedisTarget(redisUrl)
    const currentStatus = await getRedisStatus(redisUrl)

    if (currentStatus.reachable) {
        const major = parseVersionMajor(currentStatus.version)
        if ((major || 0) < 5) {
            throw new Error(
                `Redis at ${target.host}:${target.port} is incompatible (${currentStatus.version}). BullMQ requires Redis 5+.`,
            )
        }

        return {
            reused: true,
            pid: currentStatus.processId,
            version: currentStatus.version,
            edition: currentStatus.edition,
            url: redisUrl,
        }
    }

    if (!['127.0.0.1', 'localhost', '::1'].includes(target.host)) {
        throw new Error(
            `REDIS_URL points to ${target.host}:${target.port}, but that Redis server is unreachable.`,
        )
    }

    const binary = resolveCompatibleRedisBinary()
    if (!binary) {
        throw new Error(
            'No compatible local Redis binary was found. Provide REVIEW_CRAWL_REDIS_BINARY or install a Redis 5+ compatible server.',
        )
    }

    const stdoutPath = path.join(runtimeDir, 'redis.log')
    const stderrPath = path.join(runtimeDir, 'redis.err.log')

    const child = spawnDetachedProcess(binary.path, ['--port', String(target.port)], {
        cwd: path.dirname(binary.path),
        stdoutPath,
        stderrPath,
    })

    try {
        await waitFor(
            async () => {
                const status = await getRedisStatus(redisUrl)
                return status.reachable
            },
            20000,
            500,
            'a Redis 5+ compatible server',
        )
    } catch (error) {
        terminateProcess(child.pid, 'redis')
        throw error
    }

    const startedStatus = await getRedisStatus(redisUrl)
    return {
        reused: false,
        pid: child.pid,
        version: startedStatus.version || binary.version,
        edition: startedStatus.edition,
        url: redisUrl,
        binaryPath: binary.path,
    }
}

async function ensureApiReady(existingState) {
    const apiHealthy = await isApiHealthy()

    if (apiHealthy) {
        if (existingState?.api?.pid && isPidAlive(existingState.api.pid)) {
            return {
                reused: true,
                pid: existingState.api.pid,
                port: apiPort,
            }
        }

        throw new Error(
            `API port ${apiPort} is already in use by an unmanaged process. Stop it before starting the managed local stack.`,
        )
    }

    const child = spawnDetachedProcess(process.execPath, ['src/server.js'], {
        cwd: rootDir,
        stdoutPath: path.join(runtimeDir, 'api.log'),
        stderrPath: path.join(runtimeDir, 'api.err.log'),
    })

    try {
        await waitFor(isApiHealthy, 20000, 500, 'the API health endpoint')
    } catch (error) {
        terminateProcess(child.pid, 'api')
        throw error
    }

    return {
        reused: false,
        pid: child.pid,
        port: apiPort,
    }
}

async function ensureWorkerReady(existingState) {
    const expectation = getRuntimeExpectation()
    let currentHealth = null

    try {
        currentHealth = await getWorkerHealth(redisUrl)
    } catch {
        currentHealth = null
    }

    if (currentHealth) {
        const staleEntriesPresent =
            currentHealth.processors.some((entry) => entry.stale) ||
            Boolean(currentHealth.scheduler?.stale)

        if (staleEntriesPresent) {
            await cleanupStaleWorkerHeartbeats(redisUrl)

            try {
                currentHealth = await getWorkerHealth(redisUrl)
            } catch {
                currentHealth = null
            }
        }
    }

    const workerReady = hasExpectedWorkerHeartbeats(currentHealth, expectation)

    if (workerReady) {
        if (existingState?.worker?.pid && isPidAlive(existingState.worker.pid)) {
            return {
                reused: true,
                pid: existingState.worker.pid,
                runtimeMode,
            }
        }

        throw new Error(
            'Review crawl worker heartbeat already exists in Redis, but it is not tracked by the managed local stack. Stop the existing worker before starting the managed local stack.',
        )
    }

    const child = spawnDetachedProcess(
        process.execPath,
        ['src/review-crawl-worker.js'],
        {
            cwd: rootDir,
            stdoutPath: path.join(runtimeDir, 'worker.log'),
            stderrPath: path.join(runtimeDir, 'worker.err.log'),
        },
    )

    try {
        await waitFor(
            async () => {
                try {
                    const health = await getWorkerHealth(redisUrl)
                    return hasExpectedWorkerHeartbeats(health, expectation)
                } catch {
                    return false
                }
            },
            20000,
            500,
            'the review crawl worker heartbeat',
        )
    } catch (error) {
        terminateProcess(child.pid, 'worker')
        await cleanupStaleWorkerHeartbeats(redisUrl).catch(() => {})
        throw error
    }

    return {
        reused: false,
        pid: child.pid,
        runtimeMode,
    }
}

async function startStack() {
    if (!redisUrl) {
        throw new Error('REDIS_URL is required before starting the local review stack')
    }

    const previousState = readState()
    ensureRuntimeDir()

    let redis = null
    let api = null
    let worker = null

    try {
        redis = await ensureRedisReady(previousState)
        api = await ensureApiReady(previousState)
        worker = await ensureWorkerReady(previousState)

        const status = await buildStatus(previousState, {
            redis,
            api,
            worker,
        })

        writeState({
            version: 1,
            startedAt: new Date().toISOString(),
            redis,
            api,
            worker,
        config: {
            apiPort,
            queueName,
            redisUrl,
            runtimeMode,
            stackNamespace: stackNamespace || null,
        },
        })

        console.log(JSON.stringify(status, null, 2))
    } catch (error) {
        if (worker && !worker.reused) {
            terminateProcess(worker.pid, 'worker')
        }

        if (api && !api.reused) {
            terminateProcess(api.pid, 'api')
        }

        if (redis && !redis.reused) {
            terminateProcess(redis.pid, 'redis')
        }

        removeStateFile()
        throw error
    }
}

function terminateProcess(pid, label) {
    if (!pid || !isPidAlive(pid)) {
        return {
            label,
            pid,
            stopped: false,
            reason: 'not-running',
        }
    }

    try {
        process.kill(pid, 'SIGTERM')
    } catch {}

    const startedAt = Date.now()
    while (Date.now() - startedAt < 3000) {
        if (!isPidAlive(pid)) {
            return {
                label,
                pid,
                stopped: true,
                forced: false,
            }
        }
    }

    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
        })
    } else {
        try {
            process.kill(pid, 'SIGKILL')
        } catch {}
    }

    return {
        label,
        pid,
        stopped: !isPidAlive(pid),
        forced: true,
    }
}

async function stopStack() {
    const state = readState()

    if (!state || state.invalid) {
        console.log(
            JSON.stringify(
                {
                    stopped: [],
                    note: 'No managed local review stack state file was found.',
                },
                null,
                2,
            ),
        )
        removeStateFile()
        return
    }

    const stopped = []

    if (state.worker && (!state.worker.reused || forceStop)) {
        stopped.push(terminateProcess(state.worker.pid, 'worker'))
    }

    if (redisUrl) {
        try {
            await cleanupStaleWorkerHeartbeats(redisUrl)
        } catch {}
    }

    if (state.api && (!state.api.reused || forceStop)) {
        stopped.push(terminateProcess(state.api.pid, 'api'))
    }

    if (state.redis && !state.redis.reused) {
        stopped.push(terminateProcess(state.redis.pid, 'redis'))
    }

    removeStateFile()

    console.log(
        JSON.stringify(
            {
                stopped,
            },
            null,
            2,
        ),
    )
}

async function buildStatus(existingState = null, overrideState = null) {
    const managedState = overrideState || existingState || readState()
    const redisStatus = redisUrl ? await getRedisStatus(redisUrl) : null
    const apiHealthy = await isApiHealthy()

    let workerHealth = null
    if (redisStatus?.reachable) {
        try {
            workerHealth = await getWorkerHealth(redisUrl)
        } catch {
            workerHealth = null
        }
    }

    return {
        managedState: managedState && !managedState.invalid ? managedState : null,
        config: {
            apiPort,
            queueName,
            redisUrl: redisUrl || null,
            runtimeMode,
            stackNamespace: stackNamespace || null,
        },
        redis: redisStatus
            ? {
                  reachable: redisStatus.reachable,
                  version: redisStatus.version || null,
                  compatible: (parseVersionMajor(redisStatus.version) || 0) >= 5,
                  processId: redisStatus.processId,
                  edition: redisStatus.edition || null,
                  error: redisStatus.error || null,
              }
            : {
                  reachable: false,
                  version: null,
                  compatible: false,
                  processId: null,
                  edition: null,
                  error: 'REDIS_URL is not configured',
              },
        api: {
            healthy: apiHealthy,
            url: `http://${apiHost}:${apiPort}/health`,
        },
        worker: {
            processors: workerHealth?.processors || [],
            scheduler: workerHealth?.scheduler || null,
        },
    }
}

async function printStatus() {
    console.log(JSON.stringify(await buildStatus(), null, 2))
}

async function main() {
    const command = process.argv[2] || 'status'

    if (command === 'start') {
        await startStack()
        return
    }

    if (command === 'stop') {
        await stopStack()
        return
    }

    if (command === 'status') {
        await printStatus()
        return
    }

    throw new Error(`Unknown command "${command}". Use start, stop, or status.`)
}

main().catch((error) => {
    console.error(
        JSON.stringify(
            {
                error: error.message,
            },
            null,
            2,
        ),
    )
    process.exit(1)
})
