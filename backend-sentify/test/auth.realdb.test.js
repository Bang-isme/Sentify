const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('crypto')

const app = require('../src/app')
const prisma = require('../src/lib/prisma')
const { request } = require('./test-helpers')

const realDbTest =
    process.env.RUN_REAL_DB_TESTS === 'true' ? test : test.skip

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

function hasClearedCookie(setCookieHeaders, name) {
    return (setCookieHeaders || []).some(
        (entry) =>
            entry.startsWith(`${name}=`) &&
            (/Expires=Thu, 01 Jan 1970/i.test(entry) || /Max-Age=0/i.test(entry)),
    )
}

async function startRealApp() {
    return app.listen(0)
}

async function stopRealApp(server) {
    if (!server) {
        return
    }

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

realDbTest('real DB auth smoke persists refresh tokens for register, refresh, and logout', async (t) => {
    const uniqueSuffix = randomUUID()
    const email = `auth-smoke-${uniqueSuffix}@sentify.test`
    const password = `SentifySmoke!${uniqueSuffix}`
    const fullName = 'Auth Smoke'
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
        await prisma.user.deleteMany({
            where: {
                email,
            },
        })
    })

    const registerResponse = await request(server, 'POST', '/api/auth/register', {
        body: {
            email,
            password,
            fullName,
        },
    })

    assert.equal(registerResponse.status, 201)
    assert.equal(registerResponse.body.data.user.email, email)

    const registerCookies = registerResponse.headers['set-cookie']
    const registerRefreshToken = readCookieValue(registerCookies, 'sentify_refresh_token')
    const registerCsrfToken = readCookieValue(registerCookies, 'XSRF-TOKEN')

    assert.ok(readCookieValue(registerCookies, 'sentify_access_token'))
    assert.ok(registerRefreshToken)
    assert.ok(registerCsrfToken)

    const createdUser = await prisma.user.findUnique({
        where: {
            email,
        },
        include: {
            refreshTokens: {
                orderBy: {
                    createdAt: 'asc',
                },
            },
        },
    })

    assert.ok(createdUser)
    assert.equal(createdUser.refreshTokens.length, 1)
    assert.equal(createdUser.refreshTokens[0].revokedAt, null)

    const sessionCookies = buildCookieHeader(registerCookies, [
        'sentify_access_token',
        'sentify_refresh_token',
        'XSRF-TOKEN',
    ])
    const sessionResponse = await request(server, 'GET', '/api/auth/session', {
        cookies: sessionCookies,
    })

    assert.equal(sessionResponse.status, 200)
    assert.equal(sessionResponse.body.data.user.email, email)
    assert.deepEqual(sessionResponse.body.data.user.restaurants, [])

    const refreshCookies = buildCookieHeader(registerCookies, [
        'sentify_refresh_token',
        'XSRF-TOKEN',
    ])
    const refreshResponse = await request(server, 'POST', '/api/auth/refresh', {
        cookies: refreshCookies,
        headers: {
            'X-CSRF-Token': registerCsrfToken,
        },
    })

    assert.equal(refreshResponse.status, 200)
    assert.match(String(refreshResponse.body.data.expiresIn), /^\d+$/)

    const refreshedCookies = refreshResponse.headers['set-cookie']
    const rotatedRefreshToken = readCookieValue(refreshedCookies, 'sentify_refresh_token')
    const refreshedCsrfToken = readCookieValue(refreshedCookies, 'XSRF-TOKEN')

    assert.ok(rotatedRefreshToken)
    assert.notEqual(rotatedRefreshToken, registerRefreshToken)
    assert.ok(refreshedCsrfToken)

    const persistedTokens = await prisma.refreshToken.findMany({
        where: {
            userId: createdUser.id,
        },
        orderBy: {
            createdAt: 'asc',
        },
    })

    assert.equal(persistedTokens.length, 2)
    assert.ok(persistedTokens[0].revokedAt)
    assert.equal(persistedTokens[1].revokedAt, null)

    const logoutCookies = buildCookieHeader(refreshedCookies, [
        'sentify_access_token',
        'sentify_refresh_token',
        'XSRF-TOKEN',
    ])
    const logoutResponse = await request(server, 'POST', '/api/auth/logout', {
        cookies: logoutCookies,
        headers: {
            'X-CSRF-Token': refreshedCsrfToken,
        },
    })

    assert.equal(logoutResponse.status, 200)
    assert.ok(hasClearedCookie(logoutResponse.headers['set-cookie'], 'sentify_access_token'))
    assert.ok(hasClearedCookie(logoutResponse.headers['set-cookie'], 'sentify_refresh_token'))
    assert.ok(hasClearedCookie(logoutResponse.headers['set-cookie'], 'XSRF-TOKEN'))

    const userAfterLogout = await prisma.user.findUnique({
        where: {
            id: createdUser.id,
        },
        select: {
            tokenVersion: true,
        },
    })

    assert.equal(userAfterLogout.tokenVersion, 1)
})

realDbTest('real DB auth smoke updates the authenticated user profile', async (t) => {
    const uniqueSuffix = randomUUID()
    const email = `auth-profile-${uniqueSuffix}@sentify.test`
    const updatedEmail = `auth-profile-updated-${uniqueSuffix}@sentify.test`
    const password = `SentifyProfile!${uniqueSuffix}`
    const server = await startRealApp()

    t.after(async () => {
        await stopRealApp(server)
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [email, updatedEmail],
                },
            },
        })
    })

    const registerResponse = await request(server, 'POST', '/api/auth/register', {
        body: {
            email,
            password,
            fullName: 'Profile Smoke',
        },
    })

    assert.equal(registerResponse.status, 201)

    const registerCookies = registerResponse.headers['set-cookie']
    const accessSessionCookies = buildCookieHeader(registerCookies, [
        'sentify_access_token',
        'sentify_refresh_token',
        'XSRF-TOKEN',
    ])
    const csrfToken = readCookieValue(registerCookies, 'XSRF-TOKEN')

    const updateResponse = await request(server, 'PATCH', '/api/auth/profile', {
        cookies: accessSessionCookies,
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        body: {
            email: updatedEmail,
            fullName: 'Profile Smoke Updated',
        },
    })

    assert.equal(updateResponse.status, 200)
    assert.equal(updateResponse.body.data.user.email, updatedEmail)
    assert.equal(updateResponse.body.data.user.fullName, 'Profile Smoke Updated')
    assert.deepEqual(updateResponse.body.data.user.restaurants, [])

    const persistedUser = await prisma.user.findUnique({
        where: {
            email: updatedEmail,
        },
        select: {
            email: true,
            fullName: true,
        },
    })

    assert.deepEqual(persistedUser, {
        email: updatedEmail,
        fullName: 'Profile Smoke Updated',
    })
})
