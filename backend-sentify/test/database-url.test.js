const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeDatabaseUrl } = require('../src/lib/database-url')

test('normalizeDatabaseUrl upgrades external sslmode=require to verify-full', () => {
    const normalized = normalizeDatabaseUrl(
        'postgresql://user:pass@db.example.com/sentify?sslmode=require&channel_binding=require',
        {
            connectionLimit: 12,
            connectTimeoutSeconds: 10,
            statementTimeoutMs: 15000,
            idleInTransactionTimeoutMs: 15000,
        },
    )

    const parsed = new URL(normalized)
    assert.equal(parsed.searchParams.get('sslmode'), 'verify-full')
    assert.equal(parsed.searchParams.get('channel_binding'), 'require')
    assert.equal(parsed.searchParams.get('connection_limit'), '12')
    assert.equal(parsed.searchParams.get('connect_timeout'), '10')
    assert.equal(parsed.searchParams.get('statement_timeout'), '15000')
    assert.equal(
        parsed.searchParams.get('idle_in_transaction_session_timeout'),
        '15000',
    )
})

test('normalizeDatabaseUrl keeps local database urls local-safe', () => {
    const normalized = normalizeDatabaseUrl(
        'postgresql://postgres:postgres@127.0.0.1:5432/sentify?schema=public',
        10,
    )

    const parsed = new URL(normalized)
    assert.equal(parsed.searchParams.get('schema'), 'public')
    assert.equal(parsed.searchParams.get('connection_limit'), '10')
    assert.equal(parsed.searchParams.get('sslmode'), null)
})

test('normalizeDatabaseUrl preserves explicit timeout params already present in the URL', () => {
    const normalized = normalizeDatabaseUrl(
        'postgresql://user:pass@db.example.com/sentify?connect_timeout=3&statement_timeout=2000&idle_in_transaction_session_timeout=2500',
        {
            connectionLimit: 10,
            connectTimeoutSeconds: 9,
            statementTimeoutMs: 15000,
            idleInTransactionTimeoutMs: 16000,
        },
    )

    const parsed = new URL(normalized)
    assert.equal(parsed.searchParams.get('connect_timeout'), '3')
    assert.equal(parsed.searchParams.get('statement_timeout'), '2000')
    assert.equal(parsed.searchParams.get('idle_in_transaction_session_timeout'), '2500')
})

test('normalizeDatabaseUrl leaves invalid input untouched', () => {
    assert.equal(normalizeDatabaseUrl('not-a-url', 10), 'not-a-url')
})
