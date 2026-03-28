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
    clearModule('../src/modules/review-crawl/review-crawl.runtime')
    clearModule('../src/config/env')
}

test('review crawl runtime writes and clears processor heartbeat index entries', async () => {
    restoreModules()

    const calls = []

    withMock('../src/config/env', {
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl-test',
        REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS: 30000,
        REVIEW_CRAWL_SCHEDULER_LOCK_KEY: 'review-crawl-test:scheduler-lock',
        REVIEW_CRAWL_SCHEDULER_LOCK_TTL_MS: 60000,
        NODE_ENV: 'development',
        REVIEW_CRAWL_INLINE_QUEUE_MODE: false,
    })

    const runtime = require('../src/modules/review-crawl/review-crawl.runtime')
    const redis = {
        set: async (...args) => {
            calls.push(['set', ...args])
        },
        sadd: async (...args) => {
            calls.push(['sadd', ...args])
        },
        del: async (...args) => {
            calls.push(['del', ...args])
        },
        srem: async (...args) => {
            calls.push(['srem', ...args])
        },
    }

    await runtime.writeProcessorHeartbeat(redis, { runtimeMode: 'processor' })
    await runtime.clearProcessorHeartbeat(redis)

    assert.equal(calls[0][0], 'set')
    assert.equal(calls[1][0], 'sadd')
    assert.equal(calls[2][0], 'del')
    assert.equal(calls[3][0], 'srem')
    assert.equal(
        calls[1][1],
        'review-crawl-test:health:processor:index',
    )
    assert.equal(
        calls[3][1],
        'review-crawl-test:health:processor:index',
    )

    restoreModules()
})

test('review crawl runtime reads worker health from the heartbeat index and prunes stale members', async () => {
    restoreModules()

    let staleKeys = null

    withMock('../src/config/env', {
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl-test',
        REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS: 30000,
        REVIEW_CRAWL_SCHEDULER_LOCK_KEY: 'review-crawl-test:scheduler-lock',
        REVIEW_CRAWL_SCHEDULER_LOCK_TTL_MS: 60000,
        NODE_ENV: 'development',
        REVIEW_CRAWL_INLINE_QUEUE_MODE: false,
    })

    const runtime = require('../src/modules/review-crawl/review-crawl.runtime')
    const liveKey = 'review-crawl-test:health:processor:host-a:100'
    const staleKey = 'review-crawl-test:health:processor:host-b:200'
    const redis = {
        get: async () =>
            JSON.stringify({
                hostname: 'scheduler-host',
                pid: 999,
                updatedAt: '2026-03-28T03:00:00.000Z',
            }),
        smembers: async () => [liveKey, staleKey],
        mget: async (...keys) =>
            keys.map((key) =>
                key === liveKey
                    ? JSON.stringify({
                          hostname: 'processor-host',
                          pid: 100,
                          updatedAt: '2026-03-28T03:00:01.000Z',
                      })
                    : null,
            ),
        srem: async (_indexKey, ...keys) => {
            staleKeys = keys
        },
        scan: async () => {
            throw new Error('scan should not be used when the heartbeat index is populated')
        },
        keys: async () => {
            throw new Error('KEYS should never be used in runtime health reads')
        },
    }

    const health = await runtime.readReviewCrawlWorkerHealth(redis)

    assert.equal(health.configured, true)
    assert.equal(health.scheduler.pid, 999)
    assert.equal(health.processors.length, 1)
    assert.equal(health.processors[0].pid, 100)
    assert.deepEqual(staleKeys, [staleKey])

    restoreModules()
})

test('review crawl runtime falls back to SCAN when the heartbeat index is empty', async () => {
    restoreModules()

    const scanCalls = []
    const indexedKeys = []

    withMock('../src/config/env', {
        REVIEW_CRAWL_QUEUE_NAME: 'review-crawl-test',
        REVIEW_CRAWL_RUNTIME_HEALTH_TTL_MS: 30000,
        REVIEW_CRAWL_SCHEDULER_LOCK_KEY: 'review-crawl-test:scheduler-lock',
        REVIEW_CRAWL_SCHEDULER_LOCK_TTL_MS: 60000,
        NODE_ENV: 'development',
        REVIEW_CRAWL_INLINE_QUEUE_MODE: false,
    })

    const runtime = require('../src/modules/review-crawl/review-crawl.runtime')
    const scannedKey = 'review-crawl-test:health:processor:host-c:300'
    const redis = {
        get: async () => null,
        smembers: async () => [],
        scan: async (cursor, matchKeyword, matchPattern) => {
            scanCalls.push([cursor, matchKeyword, matchPattern])
            return ['0', [scannedKey]]
        },
        mget: async (...keys) =>
            keys.map(() =>
                JSON.stringify({
                    hostname: 'processor-host',
                    pid: 300,
                    updatedAt: '2026-03-28T03:05:00.000Z',
                }),
            ),
        sadd: async (_indexKey, ...keys) => {
            indexedKeys.push(...keys)
        },
        srem: async () => {},
        keys: async () => {
            throw new Error('KEYS should never be used in runtime health reads')
        },
    }

    const health = await runtime.readReviewCrawlWorkerHealth(redis)

    assert.equal(scanCalls.length, 1)
    assert.equal(health.processors.length, 1)
    assert.deepEqual(indexedKeys, [scannedKey])

    restoreModules()
})
