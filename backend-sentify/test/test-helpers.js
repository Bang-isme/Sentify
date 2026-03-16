const http = require('http')
const path = require('path')
const { randomBytes } = require('crypto')
const jwt = require('jsonwebtoken')

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

function clearAppModuleCache() {
    const appRoot = path.resolve(__dirname, '..', 'src')
    for (const modulePath of Object.keys(require.cache)) {
        if (modulePath.startsWith(appRoot)) {
            delete require.cache[modulePath]
        }
    }
}

function createTestToken(payloadOverrides = {}) {
    const payload = {
        userId: 'user-1',
        tokenVersion: 0,
        ...payloadOverrides,
    }

    return jwt.sign(payload, process.env.JWT_SECRET, {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        subject: payload.userId || payload.sub || 'user-1',
        expiresIn: '15m',
        jwtid: 'test-jti',
    })
}

function createExpiredToken(payloadOverrides = {}) {
    const payload = {
        userId: 'user-1',
        tokenVersion: 0,
        ...payloadOverrides,
    }

    return jwt.sign(payload, process.env.JWT_SECRET, {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        subject: payload.userId || payload.sub || 'user-1',
        expiresIn: '-1s',
        jwtid: 'test-jti-expired',
    })
}

function createInvalidToken() {
    return 'invalid.token.payload'
}

function buildJsonRequestBody(body) {
    if (!body) {
        return { payload: null, headers: {} }
    }

    const payload = JSON.stringify(body)
    return {
        payload,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
        },
    }
}

async function request(server, method, path, options = {}) {
    const { body, token } = options
    const { payload, headers } = buildJsonRequestBody(body)
    const address = server.address()

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: address.port,
                path,
                method,
                headers: {
                    ...headers,
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            },
            (res) => {
                let responseData = ''
                res.on('data', (chunk) => {
                    responseData += chunk
                })
                res.on('end', () => {
                    let parsed = null
                    if (responseData) {
                        try {
                            parsed = JSON.parse(responseData)
                        } catch (error) {
                            parsed = responseData
                        }
                    }
                    resolve({ status: res.statusCode, body: parsed })
                })
            },
        )

        req.on('error', reject)

        if (payload) {
            req.write(payload)
        }

        req.end()
    })
}

async function startApp(prismaOverrides = {}) {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET =
        process.env.JWT_SECRET || randomBytes(32).toString('hex')
    process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'sentify-api'
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'sentify-web'
    process.env.LOG_FORMAT = process.env.LOG_FORMAT || 'json'

    clearAppModuleCache()
    clearModule('../src/app')
    clearModule('../src/lib/prisma')
    clearModule('../src/middleware/rate-limit')
    clearModule('../src/middleware/request-logger')
    clearModule('../src/middleware/validate-uuid')
    clearModule('../src/middleware/csrf')
    clearModule('../src/lib/security-event')
    clearModule('../src/services/refresh-token.service')
    clearModule('../src/services/password-reset.service')
    clearModule('../src/services/email.service')

    const defaultPrisma = {
        user: {},
        restaurantUser: {},
        complaintKeyword: {},
        review: {},
        reviewIntakeBatch: {},
        refreshToken: {},
        passwordResetToken: {},
    }

    withMock('../src/lib/prisma', {
        ...defaultPrisma,
        ...prismaOverrides,
    })
    withMock('../src/middleware/rate-limit', {
        apiLimiter: (req, res, next) => next(),
        authLimiter: (req, res, next) => next(),
        loginLimiter: (req, res, next) => next(),
        passwordChangeLimiter: (req, res, next) => next(),
        registerLimiter: (req, res, next) => next(),
    })
    withMock('../src/middleware/csrf', {
        csrfProtection: (req, res, next) => next(),
        setCsrfCookie: () => 'mock-csrf-token',
        clearCsrfCookie: () => {},
    })
    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
    })
    withMock('../src/services/refresh-token.service', {
        REFRESH_TOKEN_TTL_DAYS: 7,
        createRefreshToken: async () => ({ raw: 'mock-refresh-token', familyId: 'mock-family' }),
        rotateRefreshToken: async () => ({ newRawToken: 'mock-new-refresh', userId: 'user-1', user: { id: 'user-1', tokenVersion: 0 } }),
        revokeAllUserTokens: async () => {},
    })
    withMock('../src/services/password-reset.service', {
        requestPasswordReset: async () => ({ message: 'If the email is registered, a reset link has been sent.' }),
        resetPassword: async () => ({ message: 'Password has been reset successfully' }),
    })
    withMock('../src/services/email.service', {
        sendEmail: async () => ({ success: true, provider: 'mock' }),
        sendPasswordResetEmail: async () => ({ success: true, provider: 'mock' }),
    })

    const app = require('../src/app')
    const server = app.listen(0)

    return { app, server }
}

async function stopApp(server) {
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

module.exports = {
    createExpiredToken,
    createInvalidToken,
    createTestToken,
    request,
    startApp,
    stopApp,
}
