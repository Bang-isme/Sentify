const test = require('node:test')
const assert = require('node:assert/strict')

const {
    isRetryableStatus,
    isTransientRequestError,
    requestJsonWithRetries,
} = require('../scripts/staging-proof-helpers')

test('isTransientRequestError accepts timeout and transient network failures', () => {
    const timeoutError = new Error('Request timed out after 60000ms')
    timeoutError.code = 'ETIMEDOUT'

    assert.equal(isTransientRequestError(timeoutError), true)
    assert.equal(
        isTransientRequestError(new Error('socket hang up while connecting')),
        true,
    )
    assert.equal(isTransientRequestError(new Error('Validation failed')), false)
})

test('isRetryableStatus only accepts transient HTTP statuses', () => {
    assert.equal(isRetryableStatus(429), true)
    assert.equal(isRetryableStatus(503), true)
    assert.equal(isRetryableStatus(200), false)
    assert.equal(isRetryableStatus(401), false)
})

test('requestJsonWithRetries retries transient request errors before succeeding', async () => {
    let attempts = 0

    const response = await requestJsonWithRetries('https://example.com', '/api/health', {
        retryAttempts: 3,
        retryDelayMs: 1,
        requestFn: async () => {
            attempts += 1

            if (attempts < 3) {
                const error = new Error('Request timed out after 15000ms')
                error.code = 'ETIMEDOUT'
                throw error
            }

            return {
                status: 200,
                body: { status: 'ok' },
            }
        },
    })

    assert.equal(attempts, 3)
    assert.equal(response.status, 200)
})

test('requestJsonWithRetries returns the last retryable response when attempts are exhausted', async () => {
    let attempts = 0

    const response = await requestJsonWithRetries('https://example.com', '/api/health', {
        retryAttempts: 2,
        retryDelayMs: 1,
        requestFn: async () => {
            attempts += 1

            return {
                status: 503,
                body: { status: 'unavailable' },
            }
        },
    })

    assert.equal(attempts, 2)
    assert.equal(response.status, 503)
})
