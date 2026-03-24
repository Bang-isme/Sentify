const test = require('node:test')
const assert = require('node:assert/strict')
const { createHash, randomBytes } = require('crypto')

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://sentify:sentify@localhost:5432/sentify'
process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex')

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
    clearModule('../src/services/refresh-token.service')
    clearModule('../src/lib/prisma')
}

function hashToken(rawToken) {
    return createHash('sha256').update(rawToken).digest('hex')
}

test('refresh token service rotates a valid token and keeps the token family stable', async () => {
    restoreModules()

    const rawToken = 'valid-refresh-token'
    let findUniqueArgs = null
    let updateArgs = null
    let createArgs = null

    withMock('../src/lib/prisma', {
        refreshToken: {
            findUnique: async (args) => {
                findUniqueArgs = args
                return {
                    id: 'rt-1',
                    userId: 'user-1',
                    familyId: 'family-1',
                    tokenHash: hashToken(rawToken),
                    revokedAt: null,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                    user: {
                        id: 'user-1',
                        tokenVersion: 3,
                    },
                }
            },
            update: async (args) => {
                updateArgs = args
                return { id: 'rt-1' }
            },
            create: async (args) => {
                createArgs = args
                return { id: 'rt-2' }
            },
        },
        $transaction: async (operations) => Promise.all(operations),
    })

    const refreshTokenService = require('../src/services/refresh-token.service')
    const result = await refreshTokenService.rotateRefreshToken(rawToken)

    assert.deepEqual(findUniqueArgs, {
        where: {
            tokenHash: hashToken(rawToken),
        },
        include: {
            user: {
                select: {
                    id: true,
                    tokenVersion: true,
                },
            },
        },
    })
    assert.equal(updateArgs.where.id, 'rt-1')
    assert.ok(updateArgs.data.revokedAt instanceof Date)
    assert.equal(createArgs.data.userId, 'user-1')
    assert.equal(createArgs.data.familyId, 'family-1')
    assert.ok(createArgs.data.expiresAt instanceof Date)
    assert.match(result.newRawToken, /^[0-9a-f]{64}$/)
    assert.equal(result.userId, 'user-1')
    assert.deepEqual(result.user, {
        id: 'user-1',
        tokenVersion: 3,
    })

    restoreModules()
})

test('refresh token service rejects unknown refresh tokens', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        refreshToken: {
            findUnique: async () => null,
        },
    })

    const refreshTokenService = require('../src/services/refresh-token.service')

    await assert.rejects(
        () => refreshTokenService.rotateRefreshToken('missing-token'),
        (error) => {
            assert.equal(error.code, 'AUTH_INVALID_REFRESH_TOKEN')
            return true
        },
    )

    restoreModules()
})

test('refresh token service rejects expired refresh tokens without rotating them', async () => {
    restoreModules()

    let updateCalled = false
    let createCalled = false

    withMock('../src/lib/prisma', {
        refreshToken: {
            findUnique: async () => ({
                id: 'rt-expired',
                userId: 'user-1',
                familyId: 'family-1',
                revokedAt: null,
                expiresAt: new Date(Date.now() - 60 * 1000),
                user: {
                    id: 'user-1',
                    tokenVersion: 0,
                },
            }),
            update: async () => {
                updateCalled = true
                return { id: 'rt-expired' }
            },
            create: async () => {
                createCalled = true
                return { id: 'rt-new' }
            },
        },
        $transaction: async (operations) => Promise.all(operations),
    })

    const refreshTokenService = require('../src/services/refresh-token.service')

    await assert.rejects(
        () => refreshTokenService.rotateRefreshToken('expired-token'),
        (error) => {
            assert.equal(error.code, 'AUTH_REFRESH_TOKEN_EXPIRED')
            return true
        },
    )

    assert.equal(updateCalled, false)
    assert.equal(createCalled, false)

    restoreModules()
})

test('refresh token service revokes the whole family on refresh token reuse', async () => {
    restoreModules()

    let updateManyArgs = null

    withMock('../src/lib/prisma', {
        refreshToken: {
            findUnique: async () => ({
                id: 'rt-reused',
                userId: 'user-1',
                familyId: 'family-9',
                revokedAt: new Date(),
                expiresAt: new Date(Date.now() + 60 * 1000),
                user: {
                    id: 'user-1',
                    tokenVersion: 0,
                },
            }),
            updateMany: async (args) => {
                updateManyArgs = args
                return { count: 3 }
            },
        },
    })

    const refreshTokenService = require('../src/services/refresh-token.service')

    await assert.rejects(
        () => refreshTokenService.rotateRefreshToken('reused-token'),
        (error) => {
            assert.equal(error.code, 'AUTH_REFRESH_TOKEN_REUSE')
            return true
        },
    )

    assert.deepEqual(updateManyArgs.where, {
        familyId: 'family-9',
    })
    assert.ok(updateManyArgs.data.revokedAt instanceof Date)

    restoreModules()
})
