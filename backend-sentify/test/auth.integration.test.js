const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('crypto')

const {
    createExpiredToken,
    createInvalidToken,
    createTestToken,
    request,
    startApp,
    stopApp,
} = require('./test-helpers')

test('auth integration flows', async (t) => {
    const validPassword = `pw-${randomUUID()}`
    const invalidPassword = `${validPassword}-bad`
    const newPassword = `pw-${randomUUID()}`

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.email === 'exists@sentify.com') {
                    return {
                        id: 'user-1',
                        email: 'exists@sentify.com',
                        fullName: 'Existing User',
                        passwordHash: 'hashed',
                        tokenVersion: 0,
                        failedLoginCount: 0,
                        lockedUntil: null,
                        restaurants: [],
                    }
                }

                if (where.id === 'user-1') {
                    return {
                        id: 'user-1',
                        email: 'owner@sentify.com',
                        fullName: 'Owner',
                        passwordHash: 'hashed',
                        tokenVersion: 0,
                        failedLoginCount: 0,
                        lockedUntil: null,
                        restaurants: [],
                    }
                }

                return null
            },
            create: async ({ data }) => ({
                id: 'user-2',
                email: data.email,
                fullName: data.fullName,
                tokenVersion: 0,
            }),
            update: async ({ where }) => ({
                id: where.id,
                email: 'owner@sentify.com',
                fullName: 'Owner',
                tokenVersion: 1,
            }),
        },
    }

    const { server } = await startApp(prismaOverrides)

    t.after(async () => {
        await stopApp(server)
    })

    const bcrypt = require('bcryptjs')
    const compareStub = bcrypt.compare
    bcrypt.compare = async (input) => input === validPassword

    const registerResponse = await request(server, 'POST', '/api/auth/register', {
        body: {
            email: 'new@sentify.com',
            password: validPassword,
            fullName: 'New User',
        },
    })

    assert.equal(registerResponse.status, 201)
    assert.equal(registerResponse.body.data.user.email, 'new@sentify.com')

    const loginResponse = await request(server, 'POST', '/api/auth/login', {
        body: {
            email: 'exists@sentify.com',
            password: validPassword,
        },
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(loginResponse.body.data.user.email, 'exists@sentify.com')

    const loginFailResponse = await request(server, 'POST', '/api/auth/login', {
        body: {
            email: 'exists@sentify.com',
            password: invalidPassword,
        },
    })

    assert.equal(loginFailResponse.status, 401)

    const sessionResponse = await request(server, 'GET', '/api/auth/session', {
        token: createTestToken({ userId: 'user-1', tokenVersion: 0 }),
    })

    assert.equal(sessionResponse.status, 200)

    const sessionNoToken = await request(server, 'GET', '/api/auth/session')
    assert.equal(sessionNoToken.status, 401)

    const sessionExpired = await request(server, 'GET', '/api/auth/session', {
        token: createExpiredToken({ userId: 'user-1', tokenVersion: 0 }),
    })
    assert.equal(sessionExpired.status, 401)

    const sessionInvalid = await request(server, 'GET', '/api/auth/session', {
        token: createInvalidToken(),
    })
    assert.equal(sessionInvalid.status, 401)

    const changePasswordResponse = await request(
        server,
        'PATCH',
        '/api/auth/password',
        {
            token: createTestToken({ userId: 'user-1', tokenVersion: 0 }),
            body: {
                currentPassword: validPassword,
                newPassword,
            },
        },
    )

    assert.equal(changePasswordResponse.status, 200)
    assert.equal(changePasswordResponse.body.data.user.email, 'owner@sentify.com')

    const changePasswordFail = await request(
        server,
        'PATCH',
        '/api/auth/password',
        {
            token: createTestToken({ userId: 'user-1', tokenVersion: 0 }),
            body: {
                currentPassword: invalidPassword,
                newPassword,
            },
        },
    )

    assert.equal(changePasswordFail.status, 401)

    const logoutResponse = await request(server, 'POST', '/api/auth/logout', {
        token: createTestToken({ userId: 'user-1', tokenVersion: 0 }),
    })
    assert.equal(logoutResponse.status, 200)

    bcrypt.compare = compareStub
})
