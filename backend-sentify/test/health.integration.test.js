const test = require('node:test')
const assert = require('node:assert/strict')

const { request, startApp, stopApp } = require('./test-helpers')

test('api health returns redis up when database and lightweight Redis probe succeed', async () => {
    const { server } = await startApp(
        {
            $queryRaw: async () => 1,
        },
        {
            nodeEnv: 'development',
            moduleOverrides: {
                '../src/modules/review-crawl/review-crawl.queue': {
                    getReviewCrawlRedisHealth: async () => ({
                        configured: true,
                        inlineMode: false,
                        status: 'UP',
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

test('api health returns unavailable when lightweight Redis probe fails', async () => {
    const { server } = await startApp(
        {
            $queryRaw: async () => 1,
        },
        {
            nodeEnv: 'development',
            moduleOverrides: {
                '../src/modules/review-crawl/review-crawl.queue': {
                    getReviewCrawlRedisHealth: async () => ({
                        configured: true,
                        inlineMode: false,
                        status: 'DOWN',
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
