const test = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('crypto')

process.env.NODE_ENV = 'development'
process.env.LOG_FORMAT = 'json'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sentify:sentify@localhost:5432/sentify'
process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex')

const app = require('../src/app')
const prisma = require('../src/lib/prisma')

function listen(serverApp) {
    return new Promise((resolve) => {
        const server = serverApp.listen(0, () => {
            resolve(server)
        })
    })
}

async function makeRequest(server, path) {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        headers: {
            'User-Agent': 'sentify-test-agent',
        },
    })
    const body = await response.json()
    return { response, body }
}

test('request logger emits a structured access log without query strings', async (t) => {
    const infoLogs = []
    const originalInfo = console.info
    console.info = (message) => {
        infoLogs.push(message)
    }

    const originalQueryRaw = prisma.$queryRaw
    prisma.$queryRaw = async () => 1

    const server = await listen(app)

    t.after(async () => {
        console.info = originalInfo
        prisma.$queryRaw = originalQueryRaw
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve()
            })
        })
    })

    const { response } = await makeRequest(server, '/api/health?q=secret')

    assert.equal(response.status, 200)
    assert.equal(infoLogs.length, 1)

    const payload = JSON.parse(infoLogs[0])
    assert.equal(payload.type, 'request_log')
    assert.equal(payload.event, 'http.request.completed')
    assert.equal(payload.method, 'GET')
    assert.equal(payload.path, '/api/health')
    assert.equal(payload.request, 'GET /api/health')
    assert.equal(payload.statusCode, 200)
    assert.equal(payload.userAgent, 'sentify-test-agent')
    assert.match(payload.requestId, /^[0-9a-f-]{36}$/i)
    assert.equal(typeof payload.durationMs, 'number')
})

test('request logger downgrades 404 responses to warning logs', async (t) => {
    const warnLogs = []
    const originalWarn = console.warn
    console.warn = (message) => {
        warnLogs.push(message)
    }

    const server = await listen(app)

    t.after(async () => {
        console.warn = originalWarn
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve()
            })
        })
    })

    const { response, body } = await makeRequest(server, '/api/missing')

    assert.equal(response.status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
    assert.equal(warnLogs.length, 1)

    const payload = JSON.parse(warnLogs[0])
    assert.equal(payload.type, 'request_log')
    assert.equal(payload.path, '/api/missing')
    assert.equal(payload.statusCode, 404)
})

test('request logger marks slow successful responses for monitoring', async (t) => {
    const warnLogs = []
    const originalWarn = console.warn
    const originalBigInt = process.hrtime.bigint
    let hrtimeCallCount = 0

    console.warn = (message) => {
        warnLogs.push(message)
    }
    process.hrtime.bigint = () => {
        hrtimeCallCount += 1
        return hrtimeCallCount === 1 ? 0n : 1500000000n
    }

    const originalQueryRaw = prisma.$queryRaw
    prisma.$queryRaw = async () => 1

    const server = await listen(app)

    t.after(async () => {
        console.warn = originalWarn
        process.hrtime.bigint = originalBigInt
        prisma.$queryRaw = originalQueryRaw
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve()
            })
        })
    })

    const { response } = await makeRequest(server, '/api/health')

    assert.equal(response.status, 200)
    assert.equal(warnLogs.length, 1)

    const payload = JSON.parse(warnLogs[0])
    assert.equal(payload.type, 'request_log')
    assert.equal(payload.path, '/api/health')
    assert.equal(payload.statusCode, 200)
    assert.equal(payload.slowRequest, true)
})
