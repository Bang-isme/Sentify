const test = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('crypto')

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
    clearModule('../src/services/auth.service')
    clearModule('../src/services/refresh-token.service')
    clearModule('../src/lib/prisma')
    clearModule('../src/lib/security-event')
    clearModule('bcryptjs')
}

test('auth service changes password and returns new access token', async () => {
    restoreModules()

    let updateArgs = null

    withMock('bcryptjs', {
        compare: async () => true,
        hash: async () => 'hashed-password',
    })
    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
    })
    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'owner@sentify.com',
                fullName: 'Sentify Owner',
                role: 'USER',
                passwordHash: 'old-hash',
                tokenVersion: 0,
            }),
            update: async (args) => {
                updateArgs = args
                return {
                    id: 'user-1',
                    email: 'owner@sentify.com',
                    fullName: 'Sentify Owner',
                    role: 'USER',
                    tokenVersion: 1,
                }
            },
        },
        refreshToken: {
            updateMany: async () => ({ count: 0 }),
            create: async () => ({ id: 'rt-1', tokenHash: 'hash', familyId: 'fam-1' }),
        },
    })

    const authService = require('../src/services/auth.service')
    const result = await authService.changePassword({
        userId: 'user-1',
        currentPassword: 'old-password',
        newPassword: 'new-password',
        context: { requestId: 'req-1' },
    })

    assert.equal(updateArgs.data.passwordHash, 'hashed-password')
    assert.equal(updateArgs.data.tokenVersion.increment, 1)
    assert.equal(result.user.id, 'user-1')
    assert.equal(result.user.role, 'USER')
    assert.equal(typeof result.accessToken, 'string')

    restoreModules()
})

test('auth service rejects invalid current password', async () => {
    restoreModules()

    withMock('bcryptjs', {
        compare: async () => false,
        hash: async () => 'hashed-password',
    })
    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
    })
    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'owner@sentify.com',
                fullName: 'Sentify Owner',
                role: 'USER',
                passwordHash: 'old-hash',
                tokenVersion: 0,
            }),
        },
    })

    const authService = require('../src/services/auth.service')

    await assert.rejects(
        () =>
            authService.changePassword({
                userId: 'user-1',
                currentPassword: 'wrong-password',
                newPassword: 'new-password',
                context: { requestId: 'req-1' },
            }),
        (error) => {
            assert.equal(error.code, 'AUTH_INVALID_CREDENTIALS')
            return true
        },
    )

    restoreModules()
})

test('auth service session maps user memberships without restaurant sub-roles', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'user@sentify.com',
                fullName: 'Sentify User',
                role: 'USER',
                restaurants: [
                    {
                        restaurant: {
                            id: 'resto-1',
                            name: 'Cafe One',
                            slug: 'cafe-one',
                            address: '1 Demo Street',
                            googleMapUrl: 'https://maps.app.goo.gl/demo',
                        },
                    },
                ],
            }),
        },
    })

    const authService = require('../src/services/auth.service')
    const result = await authService.getSession({ userId: 'user-1' })

    assert.deepEqual(result.user, {
        id: 'user-1',
        email: 'user@sentify.com',
        fullName: 'Sentify User',
        role: 'USER',
        restaurants: [
            {
                id: 'resto-1',
                name: 'Cafe One',
                slug: 'cafe-one',
            },
        ],
    })
    assert.equal('permission' in result.user.restaurants[0], false)

    restoreModules()
})

test('auth service session preserves admin role without requiring restaurant memberships', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'admin-1',
                email: 'admin@sentify.com',
                fullName: 'Sentify Admin',
                role: 'ADMIN',
                restaurants: [],
            }),
        },
    })

    const authService = require('../src/services/auth.service')
    const result = await authService.getSession({ userId: 'admin-1' })

    assert.deepEqual(result.user, {
        id: 'admin-1',
        email: 'admin@sentify.com',
        fullName: 'Sentify Admin',
        role: 'ADMIN',
        restaurants: [],
    })

    restoreModules()
})

test('auth service login rejects deactivated accounts before password verification succeeds', async () => {
    restoreModules()

    withMock('bcryptjs', {
        compare: async () => true,
        hash: async () => 'hashed-password',
    })
    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
    })
    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'owner@sentify.com',
                fullName: 'Sentify Owner',
                role: 'USER',
                passwordHash: 'old-hash',
                tokenVersion: 0,
                lockedUntil: null,
                manuallyLockedAt: null,
                deactivatedAt: new Date('2026-03-25T00:00:00Z'),
                restaurants: [],
            }),
        },
    })

    const authService = require('../src/services/auth.service')

    await assert.rejects(
        () =>
            authService.login({
                email: 'owner@sentify.com',
                password: 'old-password',
            }),
        (error) => {
            assert.equal(error.code, 'AUTH_ACCOUNT_DEACTIVATED')
            return true
        },
    )

    restoreModules()
})

test('auth service session rejects manually locked accounts', async () => {
    restoreModules()

    withMock('../src/lib/prisma', {
        user: {
            findUnique: async () => ({
                id: 'user-1',
                email: 'user@sentify.com',
                fullName: 'Sentify User',
                role: 'USER',
                manuallyLockedAt: new Date('2026-03-25T00:00:00Z'),
                lockedUntil: null,
                deactivatedAt: null,
                restaurants: [],
            }),
        },
    })

    const authService = require('../src/services/auth.service')

    await assert.rejects(
        () => authService.getSession({ userId: 'user-1' }),
        (error) => {
            assert.equal(error.code, 'AUTH_ACCOUNT_LOCKED')
            return true
        },
    )

    restoreModules()
})

test('auth service updates profile and preserves restaurant memberships in the response', async () => {
    restoreModules()

    let updateArgs = null

    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
    })
    withMock('../src/lib/prisma', {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return {
                        id: 'user-1',
                        email: 'owner@sentify.com',
                        fullName: 'Sentify Owner',
                        role: 'USER',
                        lockedUntil: null,
                        manuallyLockedAt: null,
                        deactivatedAt: null,
                        restaurants: [
                            {
                                restaurant: {
                                    id: 'resto-1',
                                    name: 'Cafe One',
                                    slug: 'cafe-one',
                                },
                            },
                        ],
                    }
                }

                if (where.email === 'updated@sentify.com') {
                    return null
                }

                return null
            },
            update: async (args) => {
                updateArgs = args
                return {
                    id: 'user-1',
                    email: 'updated@sentify.com',
                    fullName: 'Updated Owner',
                    role: 'USER',
                    restaurants: [
                        {
                            restaurant: {
                                id: 'resto-1',
                                name: 'Cafe One',
                                slug: 'cafe-one',
                            },
                        },
                    ],
                }
            },
        },
    })

    const authService = require('../src/services/auth.service')
    const result = await authService.updateProfile({
        userId: 'user-1',
        email: 'UPDATED@Sentify.com',
        fullName: 'Updated Owner',
        context: { requestId: 'req-1' },
    })

    assert.deepEqual(updateArgs.data, {
        email: 'updated@sentify.com',
        fullName: 'Updated Owner',
    })
    assert.deepEqual(result.user, {
        id: 'user-1',
        email: 'updated@sentify.com',
        fullName: 'Updated Owner',
        role: 'USER',
        restaurants: [
            {
                id: 'resto-1',
                name: 'Cafe One',
                slug: 'cafe-one',
            },
        ],
    })

    restoreModules()
})

test('auth service rejects profile email update when another user already owns it', async () => {
    restoreModules()

    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
    })
    withMock('../src/lib/prisma', {
        user: {
            findUnique: async ({ where }) => {
                if (where.id === 'user-1') {
                    return {
                        id: 'user-1',
                        email: 'owner@sentify.com',
                        fullName: 'Sentify Owner',
                        role: 'USER',
                        lockedUntil: null,
                        manuallyLockedAt: null,
                        deactivatedAt: null,
                        restaurants: [],
                    }
                }

                if (where.email === 'taken@sentify.com') {
                    return {
                        id: 'user-2',
                        email: 'taken@sentify.com',
                    }
                }

                return null
            },
        },
    })

    const authService = require('../src/services/auth.service')

    await assert.rejects(
        () =>
            authService.updateProfile({
                userId: 'user-1',
                email: 'taken@sentify.com',
                context: { requestId: 'req-1' },
            }),
        (error) => {
            assert.equal(error.code, 'EMAIL_ALREADY_EXISTS')
            return true
        },
    )

    restoreModules()
})

