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
    clearModule('../src/services/password-reset.service')
    clearModule('../src/services/refresh-token.service')
    clearModule('../src/services/email.service')
    clearModule('../src/lib/prisma')
    clearModule('bcryptjs')
}

function hashToken(rawToken) {
    return createHash('sha256').update(rawToken).digest('hex')
}

test('password reset request hides account existence for unknown emails', async () => {
    restoreModules()

    let updateManyCalled = false
    let createCalled = false
    let emailCalled = false

    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => null,
        },
        passwordResetToken: {
            updateMany: async () => {
                updateManyCalled = true
                return { count: 0 }
            },
            create: async () => {
                createCalled = true
                return { id: 'prt-1' }
            },
        },
    })
    withMock('../src/services/email.service', {
        sendPasswordResetEmail: async () => {
            emailCalled = true
            return { success: true }
        },
    })
    withMock('../src/services/refresh-token.service', {
        revokeAllUserTokens: async () => {},
    })

    const passwordResetService = require('../src/services/password-reset.service')
    const result = await passwordResetService.requestPasswordReset('missing@sentify.com')

    assert.deepEqual(result, {
        message: 'If the email is registered, a reset link has been sent.',
    })
    assert.equal(updateManyCalled, false)
    assert.equal(createCalled, false)
    assert.equal(emailCalled, false)

    restoreModules()
})

test('password reset request invalidates prior tokens, stores a hashed token, and emails the raw token', async () => {
    restoreModules()

    let updateManyArgs = null
    let createArgs = null
    let emailArgs = null

    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'owner@sentify.com',
                fullName: 'Sentify Owner',
            }),
        },
        passwordResetToken: {
            updateMany: async (args) => {
                updateManyArgs = args
                return { count: 2 }
            },
            create: async (args) => {
                createArgs = args
                return { id: 'prt-1' }
            },
        },
    })
    withMock('../src/services/email.service', {
        sendPasswordResetEmail: async (args) => {
            emailArgs = args
            return { success: true }
        },
    })
    withMock('../src/services/refresh-token.service', {
        revokeAllUserTokens: async () => {},
    })

    const passwordResetService = require('../src/services/password-reset.service')
    const before = Date.now()
    const result = await passwordResetService.requestPasswordReset('  OWNER@sentify.com ')

    assert.deepEqual(result, {
        message: 'If the email is registered, a reset link has been sent.',
    })
    assert.deepEqual(updateManyArgs.where, {
        userId: 'user-1',
        usedAt: null,
    })
    assert.ok(updateManyArgs.data.usedAt instanceof Date)
    assert.equal(createArgs.data.userId, 'user-1')
    assert.match(createArgs.data.tokenHash, /^[0-9a-f]{64}$/)
    assert.ok(createArgs.data.expiresAt instanceof Date)
    assert.ok(createArgs.data.expiresAt.getTime() > before)
    assert.deepEqual(
        {
            to: emailArgs.to,
            name: emailArgs.name,
        },
        {
            to: 'owner@sentify.com',
            name: 'Sentify Owner',
        },
    )
    assert.match(emailArgs.resetToken, /^[0-9a-f]{64}$/)
    assert.equal(createArgs.data.tokenHash, hashToken(emailArgs.resetToken))

    restoreModules()
})

test('password reset rejects invalid tokens', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        passwordResetToken: {
            findUnique: async () => null,
        },
    })
    withMock('../src/services/refresh-token.service', {
        revokeAllUserTokens: async () => {},
    })
    withMock('../src/services/email.service', {
        sendPasswordResetEmail: async () => ({ success: true }),
    })

    const passwordResetService = require('../src/services/password-reset.service')

    await assert.rejects(
        () => passwordResetService.resetPassword('invalid-token', 'new-password-123'),
        (error) => {
            assert.equal(error.code, 'INVALID_RESET_TOKEN')
            return true
        },
    )

    restoreModules()
})

test('password reset rejects used tokens', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        passwordResetToken: {
            findUnique: async () => ({
                id: 'prt-used',
                usedAt: new Date(),
                expiresAt: new Date(Date.now() + 60 * 1000),
                user: {
                    id: 'user-1',
                },
            }),
        },
    })
    withMock('../src/services/refresh-token.service', {
        revokeAllUserTokens: async () => {},
    })
    withMock('../src/services/email.service', {
        sendPasswordResetEmail: async () => ({ success: true }),
    })

    const passwordResetService = require('../src/services/password-reset.service')

    await assert.rejects(
        () => passwordResetService.resetPassword('used-token', 'new-password-123'),
        (error) => {
            assert.equal(error.code, 'RESET_TOKEN_USED')
            return true
        },
    )

    restoreModules()
})

test('password reset rejects expired tokens', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        passwordResetToken: {
            findUnique: async () => ({
                id: 'prt-expired',
                usedAt: null,
                expiresAt: new Date(Date.now() - 60 * 1000),
                user: {
                    id: 'user-1',
                },
            }),
        },
    })
    withMock('../src/services/refresh-token.service', {
        revokeAllUserTokens: async () => {},
    })
    withMock('../src/services/email.service', {
        sendPasswordResetEmail: async () => ({ success: true }),
    })

    const passwordResetService = require('../src/services/password-reset.service')

    await assert.rejects(
        () => passwordResetService.resetPassword('expired-token', 'new-password-123'),
        (error) => {
            assert.equal(error.code, 'RESET_TOKEN_EXPIRED')
            return true
        },
    )

    restoreModules()
})

test('password reset updates the password, clears lockout state, and revokes refresh tokens', async () => {
    restoreModules()

    const rawToken = 'reset-token-123'
    let passwordResetUpdateArgs = null
    let userUpdateArgs = null
    let revokedUserId = null
    let hashedPassword = null

    withMock('bcryptjs', {
        hash: async (newPassword) => {
            hashedPassword = `hashed:${newPassword}`
            return hashedPassword
        },
    })
    withMock('../src/lib/prisma', {
        passwordResetToken: {
            findUnique: async ({ where }) => ({
                id: 'prt-1',
                tokenHash: where.tokenHash,
                usedAt: null,
                expiresAt: new Date(Date.now() + 60 * 1000),
                user: {
                    id: 'user-1',
                },
            }),
            update: async (args) => {
                passwordResetUpdateArgs = args
                return { id: 'prt-1' }
            },
        },
        user: {
            update: async (args) => {
                userUpdateArgs = args
                return { id: 'user-1' }
            },
        },
        $transaction: async (operations) => Promise.all(operations),
    })
    withMock('../src/services/refresh-token.service', {
        revokeAllUserTokens: async (userId) => {
            revokedUserId = userId
        },
    })
    withMock('../src/services/email.service', {
        sendPasswordResetEmail: async () => ({ success: true }),
    })

    const passwordResetService = require('../src/services/password-reset.service')
    const result = await passwordResetService.resetPassword(rawToken, 'new-password-123')

    assert.deepEqual(result, {
        message: 'Password has been reset successfully',
    })
    assert.equal(passwordResetUpdateArgs.where.id, 'prt-1')
    assert.ok(passwordResetUpdateArgs.data.usedAt instanceof Date)
    assert.equal(userUpdateArgs.where.id, 'user-1')
    assert.equal(userUpdateArgs.data.passwordHash, hashedPassword)
    assert.equal(userUpdateArgs.data.tokenVersion.increment, 1)
    assert.equal(userUpdateArgs.data.failedLoginCount, 0)
    assert.equal(userUpdateArgs.data.lockedUntil, null)
    assert.equal(revokedUserId, 'user-1')

    restoreModules()
})
