const IORedis = require('ioredis')
const { Queue, Worker } = require('bullmq')

const env = require('../../config/env')
const { serviceUnavailable } = require('../../lib/app-error')

let sharedConnection = null
let sharedQueue = null

function isQueueConfigured() {
    return Boolean(env.REDIS_URL)
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
        if (env.NODE_ENV === 'test') {
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

    return queue.add(
        'process-run',
        {
            runId,
        },
        {
            jobId: `review-crawl-${runId}`,
            delay: options.delayMs ?? 0,
        },
    )
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
    closeReviewCrawlQueueResources,
    createReviewCrawlWorker,
    enqueueReviewCrawlRun,
    getReviewCrawlQueue,
    isQueueConfigured,
}
