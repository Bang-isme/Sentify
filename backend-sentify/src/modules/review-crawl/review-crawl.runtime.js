const os = require('node:os')

const env = require('../../config/env')

const RUNTIME_HEALTH_PREFIX = `${env.REVIEW_CRAWL_QUEUE_NAME}:health`

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

    await redis.set(
        buildProcessorHeartbeatKey(),
        JSON.stringify(buildRuntimeIdentity(extra)),
        'PX',
        env.REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS,
    )
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

async function readReviewCrawlWorkerHealth(redis) {
    if (!redis) {
        return {
            configured: false,
            scheduler: null,
            processors: [],
        }
    }

    const schedulerValue = await redis.get(buildSchedulerHeartbeatKey())
    const processorKeys = await redis.keys(`${RUNTIME_HEALTH_PREFIX}:processor:*`)
    const processorValues =
        processorKeys.length > 0 ? await redis.mget(...processorKeys) : []

    return {
        configured: true,
        scheduler: parseHeartbeatValue(schedulerValue),
        processors: processorValues.map((value) => parseHeartbeatValue(value)).filter(Boolean),
    }
}

module.exports = {
    buildProcessorHeartbeatKey,
    buildSchedulerHeartbeatKey,
    logReviewCrawlEvent,
    readReviewCrawlWorkerHealth,
    tryAcquireSchedulerLeadership,
    writeProcessorHeartbeat,
    writeSchedulerHeartbeat,
}
