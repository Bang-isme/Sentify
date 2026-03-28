const os = require('node:os')

const env = require('../../config/env')

const RUNTIME_HEALTH_PREFIX = `${env.REVIEW_CRAWL_QUEUE_NAME}:health`
const PROCESSOR_HEARTBEAT_INDEX_KEY = `${RUNTIME_HEALTH_PREFIX}:processor:index`

function logReviewCrawlEvent(event, context = {}) {
    console.info(
        JSON.stringify({
            type: 'review_crawl_event',
            timestamp: new Date().toISOString(),
            event,
            ...context,
        }),
    )
}

function buildProcessorHeartbeatKey(hostname = os.hostname(), pid = process.pid) {
    return `${RUNTIME_HEALTH_PREFIX}:processor:${hostname}:${pid}`
}

function buildSchedulerHeartbeatKey() {
    return `${RUNTIME_HEALTH_PREFIX}:scheduler`
}

function buildRuntimeIdentity(extra = {}) {
    return {
        hostname: os.hostname(),
        pid: process.pid,
        updatedAt: new Date().toISOString(),
        ...extra,
    }
}

async function writeProcessorHeartbeat(redis, extra = {}) {
    if (!redis) {
        return
    }

    const heartbeatKey = buildProcessorHeartbeatKey()
    await redis.set(
        heartbeatKey,
        JSON.stringify(buildRuntimeIdentity(extra)),
        'PX',
        env.REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS,
    )
    await redis.sadd(PROCESSOR_HEARTBEAT_INDEX_KEY, heartbeatKey)
}

async function writeSchedulerHeartbeat(redis, extra = {}) {
    if (!redis) {
        return
    }

    await redis.set(
        buildSchedulerHeartbeatKey(),
        JSON.stringify(buildRuntimeIdentity(extra)),
        'PX',
        env.REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS,
    )
}

async function clearProcessorHeartbeat(redis, hostname = os.hostname(), pid = process.pid) {
    if (!redis) {
        return
    }

    const heartbeatKey = buildProcessorHeartbeatKey(hostname, pid)
    await redis.del(heartbeatKey)
    await redis.srem(PROCESSOR_HEARTBEAT_INDEX_KEY, heartbeatKey)
}

async function clearSchedulerHeartbeat(redis) {
    if (!redis) {
        return
    }

    await redis.del(buildSchedulerHeartbeatKey())
}

async function tryAcquireSchedulerLeadership(redis, token) {
    if (!redis) {
        return true
    }

    const acquired = await redis.set(
        env.REVIEW_CRAWL_SCHEDULER_LOCK_KEY,
        token,
        'PX',
        env.REVIEW_CRAWL_SCHEDULER_LOCK_TTL_MS,
        'NX',
    )

    if (acquired === 'OK') {
        return true
    }

    const currentToken = await redis.get(env.REVIEW_CRAWL_SCHEDULER_LOCK_KEY)

    if (currentToken !== token) {
        return false
    }

    await redis.pexpire(
        env.REVIEW_CRAWL_SCHEDULER_LOCK_KEY,
        env.REVIEW_CRAWL_SCHEDULER_LOCK_TTL_MS,
    )
    return true
}

async function releaseSchedulerLeadership(redis, token) {
    if (!redis) {
        return false
    }

    const currentToken = await redis.get(env.REVIEW_CRAWL_SCHEDULER_LOCK_KEY)
    if (currentToken !== token) {
        return false
    }

    await redis.del(env.REVIEW_CRAWL_SCHEDULER_LOCK_KEY)
    return true
}

function parseHeartbeatValue(value) {
    if (!value) {
        return null
    }

    try {
        return JSON.parse(value)
    } catch {
        return {
            raw: value,
        }
    }
}

async function scanProcessorHeartbeatKeys(redis) {
    const processorKeys = []
    let cursor = '0'

    do {
        const [nextCursor, batch] = await redis.scan(
            cursor,
            'MATCH',
            `${RUNTIME_HEALTH_PREFIX}:processor:*`,
            'COUNT',
            100,
        )
        cursor = nextCursor

        if (Array.isArray(batch) && batch.length > 0) {
            processorKeys.push(...batch)
        }
    } while (cursor !== '0')

    return processorKeys
}

async function readProcessorHeartbeatEntries(redis) {
    let processorKeys = await redis.smembers(PROCESSOR_HEARTBEAT_INDEX_KEY)

    if (processorKeys.length === 0) {
        processorKeys = await scanProcessorHeartbeatKeys(redis)
        if (processorKeys.length > 0) {
            await redis.sadd(PROCESSOR_HEARTBEAT_INDEX_KEY, ...processorKeys)
        }
    }

    if (processorKeys.length === 0) {
        return []
    }

    const processorValues = await redis.mget(...processorKeys)
    const staleKeys = []
    const entries = []

    processorKeys.forEach((key, index) => {
        const value = processorValues[index]
        if (!value) {
            staleKeys.push(key)
            return
        }

        entries.push({
            key,
            value,
        })
    })

    if (staleKeys.length > 0) {
        await redis.srem(PROCESSOR_HEARTBEAT_INDEX_KEY, ...staleKeys)
    }

    return entries
}

async function readReviewCrawlWorkerHealth(redis) {
    if (!redis) {
        return {
            configured: false,
            scheduler: null,
            processors: [],
            inlineMode: env.NODE_ENV === 'test' || env.REVIEW_CRAWL_INLINE_QUEUE_MODE,
        }
    }

    const schedulerValue = await redis.get(buildSchedulerHeartbeatKey())
    const processorEntries = await readProcessorHeartbeatEntries(redis)

    return {
        configured: true,
        scheduler: parseHeartbeatValue(schedulerValue),
        processors: processorEntries
            .map((entry) => parseHeartbeatValue(entry.value))
            .filter(Boolean),
        inlineMode: false,
    }
}

module.exports = {
    buildProcessorHeartbeatKey,
    buildSchedulerHeartbeatKey,
    clearProcessorHeartbeat,
    clearSchedulerHeartbeat,
    logReviewCrawlEvent,
    readReviewCrawlWorkerHealth,
    releaseSchedulerLeadership,
    tryAcquireSchedulerLeadership,
    writeProcessorHeartbeat,
    writeSchedulerHeartbeat,
}
