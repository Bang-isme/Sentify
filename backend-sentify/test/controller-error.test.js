const test = require('node:test')
const assert = require('node:assert/strict')
const { Prisma } = require('@prisma/client')

const { handleControllerError, mapOperationalError } = require('../src/lib/controller-error')

function createResponseRecorder() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(payload) {
            this.body = payload
            return this
        },
    }
}

test('controller error mapping downgrades Prisma pool exhaustion to service unavailable', () => {
    const error = Object.assign(
        Object.create(Prisma.PrismaClientKnownRequestError.prototype),
        {
            code: 'P2024',
        },
    )

    const mapped = mapOperationalError(error)

    assert.deepEqual(mapped, {
        status: 503,
        code: 'DATABASE_POOL_EXHAUSTED',
        message: 'Database connection pool is exhausted',
    })
})

test('controller error mapping downgrades missing records to not found', () => {
    const error = Object.assign(
        Object.create(Prisma.PrismaClientKnownRequestError.prototype),
        {
            code: 'P2025',
        },
    )

    const mapped = mapOperationalError(error)

    assert.deepEqual(mapped, {
        status: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'The requested record could not be found',
    })
})

test('controller error mapping downgrades foreign key conflicts to conflict', () => {
    const error = Object.assign(
        Object.create(Prisma.PrismaClientKnownRequestError.prototype),
        {
            code: 'P2003',
        },
    )

    const mapped = mapOperationalError(error)

    assert.deepEqual(mapped, {
        status: 409,
        code: 'FOREIGN_KEY_CONSTRAINT_FAILED',
        message: 'The requested change conflicts with an existing related record',
    })
})

test('controller error mapping downgrades Prisma initialization failures to database unavailable', () => {
    const error = Object.create(Prisma.PrismaClientInitializationError.prototype)
    const mapped = mapOperationalError(error)

    assert.deepEqual(mapped, {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
    })
})

test('handleControllerError returns a 504 payload for explicit request timeouts', () => {
    const req = {
        requestId: 'req-1',
        method: 'GET',
        originalUrl: '/api/demo',
    }
    const res = createResponseRecorder()

    handleControllerError(req, res, {
        code: 'REQUEST_TIMEOUT',
    })

    assert.equal(res.statusCode, 504)
    assert.equal(res.body.error.code, 'REQUEST_TIMEOUT')
    assert.equal(res.body.error.requestId, 'req-1')
})
