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

function readCookieValue(setCookieHeaders, name) {
    const cookieHeader = (setCookieHeaders || []).find((entry) => entry.startsWith(`${name}=`))

    if (!cookieHeader) {
        return null
    }

    return decodeURIComponent(cookieHeader.split(';', 1)[0].slice(`${name}=`.length))
}

function buildCookieHeader(setCookieHeaders, names) {
    return names
        .map((name) => {
            const value = readCookieValue(setCookieHeaders, name)
            return value ? `${name}=${encodeURIComponent(value)}` : null
        })
        .filter(Boolean)
        .join('; ')
}

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

    const { server } = await startApp(prismaOverrides, { mockCsrf: false })

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
    assert.ok(readCookieValue(registerResponse.headers['set-cookie'], 'XSRF-TOKEN'))

    const loginResponse = await request(server, 'POST', '/api/auth/login', {
        body: {
            email: 'exists@sentify.com',
            password: validPassword,
        },
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(loginResponse.body.data.user.email, 'exists@sentify.com')
    assert.ok(readCookieValue(loginResponse.headers['set-cookie'], 'XSRF-TOKEN'))

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

test('cookie-authenticated writes require a matching csrf token', async (t) => {
    const validPassword = `pw-${randomUUID()}`

    const prismaOverrides = {
        user: {
            findUnique: async ({ where }) => {
                if (where.email === 'exists@sentify.com' || where.id === 'user-1') {
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

                return null
            },
            update: async ({ where }) => ({
                id: where.id,
                email: 'exists@sentify.com',
                fullName: 'Existing User',
                tokenVersion: 1,
            }),
        },
    }

    const { server } = await startApp(prismaOverrides, { mockCsrf: false })

    t.after(async () => {
        await stopApp(server)
    })

    const bcrypt = require('bcryptjs')
    const compareStub = bcrypt.compare
    bcrypt.compare = async (input) => input === validPassword

    const loginResponse = await request(server, 'POST', '/api/auth/login', {
        body: {
            email: 'exists@sentify.com',
            password: validPassword,
        },
    })

    assert.equal(loginResponse.status, 200)

    const issuedCookies = loginResponse.headers['set-cookie']
    const accessSessionCookies = buildCookieHeader(issuedCookies, [
        'sentify_access_token',
        'sentify_refresh_token',
        'XSRF-TOKEN',
    ])
    const refreshSessionCookies = buildCookieHeader(issuedCookies, [
        'sentify_refresh_token',
    ])
    const csrfToken = readCookieValue(issuedCookies, 'XSRF-TOKEN')

    const logoutWithoutCsrf = await request(server, 'POST', '/api/auth/logout', {
        cookies: accessSessionCookies,
    })

    assert.equal(logoutWithoutCsrf.status, 403)
    assert.equal(logoutWithoutCsrf.body.error.code, 'CSRF_VALIDATION_FAILED')

    const refreshWithoutCsrf = await request(server, 'POST', '/api/auth/refresh', {
        cookies: refreshSessionCookies,
    })

    assert.equal(refreshWithoutCsrf.status, 403)
    assert.equal(refreshWithoutCsrf.body.error.code, 'CSRF_VALIDATION_FAILED')

    const csrfBootstrapResponse = await request(server, 'GET', '/api/auth/csrf', {
        cookies: refreshSessionCookies,
    })

    assert.equal(csrfBootstrapResponse.status, 204)

    const refreshCsrfCookie = readCookieValue(csrfBootstrapResponse.headers['set-cookie'], 'XSRF-TOKEN')

    assert.ok(refreshCsrfCookie)

    const refreshCookiePair = ['XSRF-TOKEN', encodeURIComponent(refreshCsrfCookie)].join('=')

    const refreshWithCsrf = await request(server, 'POST', '/api/auth/refresh', {
        cookies: `${refreshSessionCookies}; ${refreshCookiePair}`,
        headers: {
            'X-CSRF-Token': refreshCsrfCookie,
        },
    })

    assert.equal(refreshWithCsrf.status, 200)
    assert.ok(readCookieValue(refreshWithCsrf.headers['set-cookie'], 'XSRF-TOKEN'))

    const logoutWithCsrf = await request(server, 'POST', '/api/auth/logout', {
        cookies: accessSessionCookies,
        headers: {
            'X-CSRF-Token': csrfToken,
        },
    })

    assert.equal(logoutWithCsrf.status, 200)

    bcrypt.compare = compareStub
})
