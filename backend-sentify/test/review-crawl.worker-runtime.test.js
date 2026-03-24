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
    clearModule('../src/modules/review-crawl/review-crawl.worker-runtime')
    clearModule('../src/modules/review-crawl/review-crawl.queue')
    clearModule('../src/modules/review-crawl/review-crawl.runtime')
    clearModule('../src/modules/review-crawl/review-crawl.service')
    clearModule('../src/config/env')
}

test('review crawl worker runtime starts processor and scheduler lanes with heartbeats', async () => {
    restoreModules()

    const events = []
    const serviceCalls = []
    let workerClosed = false
    let queueClosed = false
    let intervalCalls = []

    const originalSetInterval = global.setInterval
    const originalClearInterval = global.clearInterval

    global.setInterval = (callback, ms) => {
        const handle = {
            callback,
            ms,
            unref() {},
        }
        intervalCalls.push(handle)
        return handle
    }
    global.clearInterval = (handle) => {
        intervalCalls = intervalCalls.filter((candidate) => candidate !== handle)
    }

    withMock('../src/config/env', {
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_WORKER_CONCURRENCY: 3,
        REVIEW_CRAWL_SCHEDULER_INTERVAL_MS: 15000,
        REVIEW_CRAWL_RUNTIME_MODE: 'both',
        REVIEW_CRAWL_HEARTBEAT_INTERVAL_MS: 20000,
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        isQueueConfigured: () => true,
        getRedisConnection: () => ({ id: 'redis-1' }),
        createReviewCrawlWorker: (processor) => {
            assert.equal(typeof processor, 'function')

            return {
                on(eventName) {
                    events.push(eventName)
                },
                close: async () => {
                    workerClosed = true
                },
            }
        },
        closeReviewCrawlQueueResources: async () => {
            queueClosed = true
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: (name, payload) => {
            events.push({ name, payload })
        },
        tryAcquireSchedulerLeadership: async () => true,
        writeProcessorHeartbeat: async (_redis, payload) => {
            events.push({ name: 'processor_heartbeat', payload })
        },
        writeSchedulerHeartbeat: async (_redis, payload) => {
            events.push({ name: 'scheduler_heartbeat', payload })
        },
    })
    withMock('../src/modules/review-crawl/review-crawl.service', {
        processReviewCrawlRun: async (runId) => ({ runId }),
        scheduleDueReviewCrawlRuns: async () => {
            serviceCalls.push('schedule')
            return { scheduledCount: 0 }
        },
    })

    const {
        startReviewCrawlWorkerRuntime,
    } = require('../src/modules/review-crawl/review-crawl.worker-runtime')
    const runtime = await startReviewCrawlWorkerRuntime()

    assert.equal(intervalCalls.length, 2)
    assert.deepEqual(serviceCalls, ['schedule'])
    assert.ok(events.includes('completed'))
    assert.ok(events.includes('failed'))
    assert.ok(events.some((event) => event.name === 'processor_heartbeat'))
    assert.ok(events.some((event) => event.name === 'scheduler_heartbeat'))
    assert.ok(
        events.some(
            (event) =>
                event.name === 'worker.started' && event.payload.runtimeMode === 'both',
        ),
    )

    await runtime.stop()

    assert.equal(workerClosed, true)
    assert.equal(queueClosed, true)
    assert.equal(intervalCalls.length, 0)

    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
    restoreModules()
})

test('review crawl worker runtime can run in scheduler-only mode without creating a worker', async () => {
    restoreModules()

    let workerCreated = false
    const serviceCalls = []

    const originalSetInterval = global.setInterval
    const originalClearInterval = global.clearInterval

    global.setInterval = (callback, ms) => ({
        callback,
        ms,
        unref() {},
    })
    global.clearInterval = () => {}

    withMock('../src/config/env', {
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_WORKER_CONCURRENCY: 3,
        REVIEW_CRAWL_SCHEDULER_INTERVAL_MS: 15000,
        REVIEW_CRAWL_RUNTIME_MODE: 'scheduler',
        REVIEW_CRAWL_HEARTBEAT_INTERVAL_MS: 20000,
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        isQueueConfigured: () => true,
        getRedisConnection: () => ({ id: 'redis-1' }),
        createReviewCrawlWorker: () => {
            workerCreated = true
            return null
        },
        closeReviewCrawlQueueResources: async () => {},
    })
    withMock('../src/modules/review-crawl/review-crawl.runtime', {
        logReviewCrawlEvent: () => {},
        tryAcquireSchedulerLeadership: async () => true,
        writeProcessorHeartbeat: async () => {},
        writeSchedulerHeartbeat: async () => {},
    })
    withMock('../src/modules/review-crawl/review-crawl.service', {
        processReviewCrawlRun: async () => null,
        scheduleDueReviewCrawlRuns: async () => {
            serviceCalls.push('schedule')
            return { scheduledCount: 0 }
        },
    })

    const {
        startReviewCrawlWorkerRuntime,
    } = require('../src/modules/review-crawl/review-crawl.worker-runtime')
    const runtime = await startReviewCrawlWorkerRuntime()

    assert.equal(workerCreated, false)
    assert.equal(runtime.worker, null)
    assert.deepEqual(serviceCalls, ['schedule'])

    await runtime.stop()

    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
    restoreModules()
})
