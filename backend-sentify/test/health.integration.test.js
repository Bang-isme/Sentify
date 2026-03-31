const test = require('node:test')
const assert = require('node:assert/strict')

const { request, startApp, stopApp } = require('./test-helpers')

test('api health returns redis up when database and queue probes succeed', async () => {
    const { server } = await startApp(
        {
            $queryRaw: async () => 1,
        },
        {
            nodeEnv: 'development',
            moduleOverrides: {
                '../src/modules/review-crawl/review-crawl.queue': {
                    getReviewCrawlQueueHealth: async () => ({
                        configured: true,
                        inlineMode: false,
                        counts: {
                            waiting: 0,
                            active: 0,
                            completed: 0,
                            failed: 0,
                            delayed: 0,
                        },
                    }),
                },
            },
        },
    )

    try {
        const response = await request(server, 'GET', '/api/health')

        assert.equal(response.status, 200)
        assert.deepEqual(response.body, {
            status: 'ok',
            db: 'up',
            redis: 'up',
        })
    } finally {
        await stopApp(server)
    }
})

test('api health returns unavailable when Redis queue probe fails', async () => {
    const { server } = await startApp(
        {
            $queryRaw: async () => 1,
        },
        {
            nodeEnv: 'development',
            moduleOverrides: {
                '../src/modules/review-crawl/review-crawl.queue': {
                    getReviewCrawlQueueHealth: async () => ({
                        configured: true,
                        inlineMode: false,
                        counts: null,
                        errorMessage: 'redis down',
                    }),
                },
            },
        },
    )

    try {
        const response = await request(server, 'GET', '/api/health')

        assert.equal(response.status, 503)
        assert.deepEqual(response.body, {
            status: 'unavailable',
            db: 'up',
            redis: 'down',
        })
    } finally {
        await stopApp(server)
    }
})
