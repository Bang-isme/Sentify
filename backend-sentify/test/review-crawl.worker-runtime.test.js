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

test('review crawl worker runtime starts the worker, schedules immediately, and stops cleanly', async () => {
    restoreModules()

    const events = []
    const serviceCalls = []
    let intervalMs = null
    let timerWasCleared = false
    let workerClosed = false
    let queueClosed = false

    const originalSetInterval = global.setInterval
    const originalClearInterval = global.clearInterval

    global.setInterval = (callback, ms) => {
        intervalMs = ms
        return {
            callback,
            unref() {},
        }
    }
    global.clearInterval = () => {
        timerWasCleared = true
    }

    withMock('../src/config/env', {
        REDIS_URL: 'redis://127.0.0.1:6379',
        REVIEW_CRAWL_WORKER_CONCURRENCY: 3,
        REVIEW_CRAWL_SCHEDULER_INTERVAL_MS: 15000,
    })
    withMock('../src/modules/review-crawl/review-crawl.queue', {
        isQueueConfigured: () => true,
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

    assert.equal(intervalMs, 15000)
    assert.deepEqual(serviceCalls, ['schedule'])
    assert.ok(events.includes('completed'))
    assert.ok(events.includes('failed'))

    await runtime.stop()

    assert.equal(timerWasCleared, true)
    assert.equal(workerClosed, true)
    assert.equal(queueClosed, true)

    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
    restoreModules()
})
