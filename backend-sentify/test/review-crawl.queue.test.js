const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function withMock(modulePath, exports) {
    require.cache[require.resolve(modulePath)] = {
        id: require.resolve(modulePath),
        filename: require.resolve(modulePath),
        loaded: true,
        exports,
    }
}

function restoreModules() {
    clearModule('../src/modules/review-crawl/review-crawl.queue')
    clearModule('../src/config/env')
    clearModule('ioredis')
    clearModule('bullmq')
}

test('review crawl queue enqueues run jobs with a BullMQ-safe job id', async () => {
    restoreModules()

    let addArgs = null
    let queueOptions = null

    withMock('../src/config/env', {
        NODE_ENV: 'development',
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl',
        REVIEW_CRAWL_MAX_RETRIES: 3,
        REVIEW_CRAWL_RETRY_BASE_DELAY_MS: 5000,
        REVIEW_CRAWL_JOB_TIMEOUT_MS: 600000,
        REVIEW_CRAWL_WORKER_CONCURRENCY: 2,
        REVIEW_CRAWL_LEASE_SECONDS: 90,
    })
    withMock('ioredis', function MockIORedis() {
        return {
            info: async () => 'redis_version:8.4.0\nmaxmemory_policy:noeviction',
        }
    })
    withMock('bullmq', {
        Queue: class MockQueue {
            constructor(_name, options) {
                queueOptions = options
            }

            async add(name, data, options) {
                addArgs = { name, data, options }
                return { id: options.jobId }
            }
        },
        Worker: class MockWorker {},
    })

    const queue = require('../src/modules/review-crawl/review-crawl.queue')
    const result = await queue.enqueueReviewCrawlRun('run-123')

    assert.equal(result.id, 'review-crawl-run-123')
    assert.equal(addArgs.name, 'process-run')
    assert.equal(addArgs.options.jobId, 'review-crawl-run-123')
    assert.equal(queueOptions.skipVersionCheck, true)

    restoreModules()
})

test('review crawl queue health surfaces unsafe Redis deployment policy', async () => {
    restoreModules()

    withMock('../src/config/env', {
        NODE_ENV: 'development',
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl',
        REVIEW_CRAWL_MAX_RETRIES: 3,
        REVIEW_CRAWL_RETRY_BASE_DELAY_MS: 5000,
        REVIEW_CRAWL_JOB_TIMEOUT_MS: 600000,
        REVIEW_CRAWL_WORKER_CONCURRENCY: 2,
        REVIEW_CRAWL_LEASE_SECONDS: 90,
    })
    withMock('ioredis', function MockIORedis() {
        return {
            info: async () =>
                'redis_version:8.4.0\nredis_mode:standalone\nmaxmemory_policy:volatile-lru',
        }
    })
    withMock('bullmq', {
        Queue: class MockQueue {
            async getJobCounts() {
                return {
                    waiting: 0,
                    active: 0,
                    completed: 0,
                    failed: 0,
                    delayed: 0,
                }
            }
        },
        Worker: class MockWorker {},
    })

    const queue = require('../src/modules/review-crawl/review-crawl.queue')
    const health = await queue.getReviewCrawlQueueHealth()

    assert.equal(health.configured, true)
    assert.equal(health.deployment.evictionPolicyStatus, 'FAILED')
    assert.equal(health.deployment.safeForBullMq, false)
    assert.equal(health.durabilityEnforced, false)
    assert.equal(health.durabilityBlocking, false)

    restoreModules()
})

test('review crawl queue can enforce BullMQ-safe Redis durability before enqueueing', async () => {
    restoreModules()

    withMock('../src/config/env', {
        NODE_ENV: 'development',
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl',
        REVIEW_CRAWL_MAX_RETRIES: 3,
        REVIEW_CRAWL_RETRY_BASE_DELAY_MS: 5000,
        REVIEW_CRAWL_JOB_TIMEOUT_MS: 600000,
        REVIEW_CRAWL_WORKER_CONCURRENCY: 2,
        REVIEW_CRAWL_LEASE_SECONDS: 90,
        REVIEW_CRAWL_REQUIRE_SAFE_REDIS: true,
    })
    withMock('ioredis', function MockIORedis() {
        return {
            info: async () =>
                'redis_version:8.4.0\nredis_mode:standalone\nmaxmemory_policy:volatile-lru',
        }
    })
    withMock('bullmq', {
        Queue: class MockQueue {
            async add() {
                throw new Error('should not enqueue when durability is unsafe')
            }
        },
        Worker: class MockWorker {},
    })

    const queue = require('../src/modules/review-crawl/review-crawl.queue')

    await assert.rejects(
        () => queue.enqueueReviewCrawlRun('run-unsafe'),
        (error) =>
            error?.code === 'REVIEW_CRAWL_REDIS_DURABILITY_UNSAFE' &&
            error?.statusCode === 503 &&
            error?.details?.maxMemoryPolicy === 'volatile-lru',
    )

    const health = await queue.getReviewCrawlQueueHealth()
    assert.equal(health.durabilityEnforced, true)
    assert.equal(health.durabilityBlocking, true)

    restoreModules()
})

test('review crawl queue health degrades gracefully when Redis job counts cannot be read', async () => {
    restoreModules()

    withMock('../src/config/env', {
        NODE_ENV: 'development',
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl',
        REVIEW_CRAWL_MAX_RETRIES: 3,
        REVIEW_CRAWL_RETRY_BASE_DELAY_MS: 5000,
        REVIEW_CRAWL_JOB_TIMEOUT_MS: 600000,
        REVIEW_CRAWL_WORKER_CONCURRENCY: 2,
        REVIEW_CRAWL_LEASE_SECONDS: 90,
    })
    withMock('ioredis', function MockIORedis() {
        return {
            info: async () => 'redis_version:8.4.0\nmaxmemory_policy:noeviction',
        }
    })
    withMock('bullmq', {
        Queue: class MockQueue {
            async getJobCounts() {
                throw new Error('redis down')
            }
        },
        Worker: class MockWorker {},
    })

    const queue = require('../src/modules/review-crawl/review-crawl.queue')
    const health = await queue.getReviewCrawlQueueHealth()

    assert.equal(health.configured, true)
    assert.equal(health.counts, null)
    assert.equal(health.errorMessage, 'redis down')
    assert.equal(health.deployment.safeForBullMq, true)

    restoreModules()
})

test('review crawl queue surfaces enqueue failures as service unavailable errors', async () => {
    restoreModules()

    withMock('../src/config/env', {
        NODE_ENV: 'development',
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl',
        REVIEW_CRAWL_MAX_RETRIES: 3,
        REVIEW_CRAWL_RETRY_BASE_DELAY_MS: 5000,
        REVIEW_CRAWL_JOB_TIMEOUT_MS: 600000,
        REVIEW_CRAWL_WORKER_CONCURRENCY: 2,
        REVIEW_CRAWL_LEASE_SECONDS: 90,
    })
    withMock('ioredis', function MockIORedis() {
        return {
            info: async () => 'redis_version:8.4.0\nmaxmemory_policy:noeviction',
        }
    })
    withMock('bullmq', {
        Queue: class MockQueue {
            async add() {
                throw new Error('redis enqueue failed')
            }
        },
        Worker: class MockWorker {},
    })

    const queue = require('../src/modules/review-crawl/review-crawl.queue')

    await assert.rejects(
        () => queue.enqueueReviewCrawlRun('run-123'),
        (error) =>
            error?.code === 'REVIEW_CRAWL_QUEUE_ENQUEUE_FAILED' &&
            error?.statusCode === 503 &&
            error?.details?.reason === 'redis enqueue failed',
    )

    restoreModules()
})
