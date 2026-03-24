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
        return {}
    })
    withMock('bullmq', {
        Queue: class MockQueue {
            constructor(_name, _options) {}

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

    restoreModules()
})
