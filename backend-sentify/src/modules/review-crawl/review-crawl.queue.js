const IORedis = require('ioredis')
const { Queue, Worker } = require('bullmq')

const env = require('../../config/env')
const { serviceUnavailable } = require('../../lib/app-error')
const { buildRedisDeploymentReport } = require('../../lib/redis-deployment')

let sharedConnection = null
let sharedQueue = null

function buildQueueServiceUnavailableError(code, message, error) {
    return serviceUnavailable(code, message, {
        reason: error?.message || 'Redis operation failed',
    })
}

function buildReviewCrawlJobId(runId) {
    return `review-crawl-${runId}`
}

function isQueueConfigured() {
    return Boolean(env.REDIS_URL)
}

function isInlineQueueMode() {
    return env.NODE_ENV === 'test' || env.REVIEW_CRAWL_INLINE_QUEUE_MODE
}

function getRedisConnection() {
    if (!isQueueConfigured()) {
        return null
    }

    if (!sharedConnection) {
        sharedConnection = new IORedis(env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        })
    }

    return sharedConnection
}

async function readRedisDeployment(connection = getRedisConnection()) {
    if (!connection) {
        return {
            configured: false,
            status: 'UNCONFIGURED',
            safeForBullMq: false,
            warnings: [],
        }
    }

    try {
        return {
            configured: true,
            ...buildRedisDeploymentReport(await connection.info()),
        }
    } catch (error) {
        return {
            configured: true,
            status: 'UNKNOWN',
            safeForBullMq: false,
            warnings: ['Redis deployment metadata could not be read.'],
            errorMessage: error?.message || 'Redis INFO probe failed',
        }
    }
}

function getReviewCrawlQueue() {
    if (!isQueueConfigured()) {
        throw serviceUnavailable(
            'REVIEW_CRAWL_QUEUE_UNAVAILABLE',
            'Redis is not configured for review crawl jobs',
        )
    }

    if (!sharedQueue) {
        sharedQueue = new Queue(env.REVIEW_CRAWL_QUEUE_NAME, {
            connection: getRedisConnection(),
            skipVersionCheck: true,
            defaultJobOptions: {
                attempts: env.REVIEW_CRAWL_MAX_RETRIES + 1,
                backoff: {
                    type: 'exponential',
                    delay: env.REVIEW_CRAWL_RETRY_BASE_DELAY_MS,
                },
                removeOnComplete: 1000,
                removeOnFail: 1000,
                timeout: env.REVIEW_CRAWL_JOB_TIMEOUT_MS,
            },
        })
    }

    return sharedQueue
}

async function enqueueReviewCrawlRun(runId, options = {}) {
    if (!isQueueConfigured()) {
        if (isInlineQueueMode()) {
            return {
                id: `test-inline:${runId}`,
                name: 'process-run',
                data: { runId },
            }
        }

        throw serviceUnavailable(
            'REVIEW_CRAWL_QUEUE_UNAVAILABLE',
            'Redis is required to enqueue review crawl jobs',
        )
    }

    const queue = getReviewCrawlQueue()

    try {
        return await queue.add(
            'process-run',
            {
                runId,
            },
            {
                jobId: buildReviewCrawlJobId(runId),
                delay: options.delayMs ?? 0,
            },
        )
    } catch (error) {
        throw buildQueueServiceUnavailableError(
            'REVIEW_CRAWL_QUEUE_ENQUEUE_FAILED',
            'Review crawl queue is unavailable right now',
            error,
        )
    }
}

async function getReviewCrawlJob(runId) {
    if (!isQueueConfigured()) {
        return null
    }

    try {
        return await getReviewCrawlQueue().getJob(buildReviewCrawlJobId(runId))
    } catch (error) {
        throw buildQueueServiceUnavailableError(
            'REVIEW_CRAWL_QUEUE_LOOKUP_FAILED',
            'Review crawl queue status is unavailable right now',
            error,
        )
    }
}

async function getReviewCrawlQueueHealth() {
    if (!isQueueConfigured()) {
        return {
            configured: false,
            counts: null,
            inlineMode: isInlineQueueMode(),
        }
    }

    const queue = getReviewCrawlQueue()

    try {
        const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
        )

        return {
            configured: true,
            counts,
            inlineMode: false,
            deployment: await readRedisDeployment(),
        }
    } catch (error) {
        return {
            configured: true,
            counts: null,
            inlineMode: false,
            deployment: await readRedisDeployment(),
            errorMessage:
                error instanceof Error
                    ? error.message
                    : 'Review crawl queue health probe failed',
        }
    }
}

function createReviewCrawlWorker(processor) {
    if (!isQueueConfigured()) {
        throw new Error('REDIS_URL is required to start the review crawl worker')
    }

    return new Worker(
        env.REVIEW_CRAWL_QUEUE_NAME,
        async (job) => {
            if (job.name !== 'process-run') {
                return null
            }

            return processor(job.data.runId, job)
        },
        {
            connection: getRedisConnection(),
            skipVersionCheck: true,
            concurrency: env.REVIEW_CRAWL_WORKER_CONCURRENCY,
            lockDuration: env.REVIEW_CRAWL_LEASE_SECONDS * 1000,
        },
    )
}

async function closeReviewCrawlQueueResources() {
    if (sharedQueue) {
        await sharedQueue.close()
        sharedQueue = null
    }

    if (sharedConnection) {
        await sharedConnection.quit()
        sharedConnection = null
    }
}

module.exports = {
    buildReviewCrawlJobId,
    closeReviewCrawlQueueResources,
    createReviewCrawlWorker,
    enqueueReviewCrawlRun,
    getRedisConnection,
    getReviewCrawlJob,
    getReviewCrawlQueue,
    getReviewCrawlQueueHealth,
    isInlineQueueMode,
    isQueueConfigured,
    readRedisDeployment,
}
