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

