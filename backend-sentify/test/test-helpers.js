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
    const { body, token, headers: extraHeaders = {}, cookies = null } = options
    const { payload, headers } = buildJsonRequestBody(body)
    const address = server.address()

    const requestHeaders = {
        ...headers,
        ...extraHeaders,
        ...(cookies ? { Cookie: cookies } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: address.port,
                path,
                method,
                headers: requestHeaders,
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
                    resolve({ status: res.statusCode, body: parsed, headers: res.headers })
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

async function startApp(prismaOverrides = {}, options = {}) {
    const {
        nodeEnv = 'test',
        mockCsrf = true,
        securityEventOverrides = null,
        refreshTokenServiceOverrides = null,
        passwordResetServiceOverrides = null,
        emailServiceOverrides = null,
        moduleOverrides = {},
    } = options

    process.env.NODE_ENV = nodeEnv
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
        $queryRaw: async () => [{ '?column?': 1 }],
        user: {},
        restaurant: {
            create: async ({ data }) => ({
                id: 'restaurant-1',
                ...data,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            update: async ({ where, data }) => ({
                id: where.id,
                name: data.name ?? 'Restaurant',
                slug: 'restaurant',
                address: data.address ?? null,
                googleMapUrl:
                    Object.prototype.hasOwnProperty.call(data, 'googleMapUrl')
                        ? data.googleMapUrl
                        : null,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            findMany: async () => [],
            findUnique: async () => null,
        },
        restaurantUser: {
            create: async ({ data }) => ({
                id: 'restaurant-user-1',
                ...data,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            findFirst: async () => null,
            findMany: async () => [],
        },
        complaintKeyword: {},
        review: {
            findMany: async () => [],
        },
        reviewIntakeItem: {
            groupBy: async () => [],
        },
        reviewIntakeBatch: {
            findFirst: async () => null,
            findMany: async () => [],
            findUnique: async () => null,
        },
        reviewCrawlSource: {
            findFirst: async () => null,
            findUnique: async () => null,
            findMany: async () => [],
            upsert: async ({ create }) => ({
                id: 'crawl-source-1',
                ...create,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
        },
        reviewCrawlRun: {
            findFirst: async () => null,
        },
        reviewCrawlRawReview: {},
        restaurantSourceSubmission: {
            findUnique: async () => null,
            findMany: async () => [],
            updateMany: async () => ({ count: 0 }),
            upsert: async ({ create }) => ({
                id: 'source-submission-1',
                ...create,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            update: async ({ data, where }) => ({
                id: where.id ?? 'source-submission-1',
                ...data,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            deleteMany: async () => ({ count: 0 }),
        },
        restaurantEntitlement: {
            findUnique: async () => null,
            upsert: async ({ create, update = {} }) => ({
                id: 'restaurant-entitlement-1',
                ...create,
                ...update,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
        },
        platformControl: {
            upsert: async ({ update = {}, create = {} }) => ({
                id: 'platform',
                crawlQueueWritesEnabled: true,
                crawlMaterializationEnabled: true,
                intakePublishEnabled: true,
                sourceSubmissionAutoBootstrapEnabled: true,
                sourceSubmissionAutoBootstrapMaxPerTick: 20,
                note: null,
                updatedByUserId: null,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
                updatedAt: new Date('2026-03-27T00:00:00.000Z'),
                ...create,
                ...update,
            }),
            findMany: async () => [],
        },
        auditEvent: {
            create: async ({ data }) => ({
                id: 'audit-event-1',
                ...data,
                createdAt: new Date('2026-03-27T00:00:00.000Z'),
            }),
            createMany: async ({ data }) => ({
                count: Array.isArray(data) ? data.length : 0,
            }),
            findMany: async () => [],
        },
        refreshToken: {},
        passwordResetToken: {},
    }

    const mergedPrisma = {
        ...defaultPrisma,
    }

    for (const [key, value] of Object.entries(prismaOverrides)) {
        const defaultValue = defaultPrisma[key]
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            defaultValue &&
            typeof defaultValue === 'object' &&
            !Array.isArray(defaultValue)
        ) {
            mergedPrisma[key] = {
                ...defaultValue,
                ...value,
            }
            continue
        }

        mergedPrisma[key] = value
    }

    if (!Object.prototype.hasOwnProperty.call(prismaOverrides, '$transaction')) {
        mergedPrisma.$transaction = async (operations) => {
            if (typeof operations === 'function') {
                return operations(mergedPrisma)
            }

            return Promise.all(operations)
        }
    }

    withMock('../src/lib/prisma', mergedPrisma)
    withMock('../src/middleware/rate-limit', {
        apiLimiter: (req, res, next) => next(),
        authLimiter: (req, res, next) => next(),
        loginLimiter: (req, res, next) => next(),
        passwordChangeLimiter: (req, res, next) => next(),
        registerLimiter: (req, res, next) => next(),
    })
    if (mockCsrf) {
        withMock('../src/middleware/csrf', {
            csrfProtection: (req, res, next) => next(),
            setCsrfCookie: () => 'mock-csrf-token',
            clearCsrfCookie: () => {},
        })
    }
    withMock('../src/lib/security-event', {
        logSecurityEvent: () => {},
        ...securityEventOverrides,
    })
    withMock('../src/services/refresh-token.service', {
        REFRESH_TOKEN_TTL_DAYS: 7,
        createRefreshToken: async () => ({ raw: 'mock-refresh-token', familyId: 'mock-family' }),
        rotateRefreshToken: async () => ({ newRawToken: 'mock-new-refresh', userId: 'user-1', user: { id: 'user-1', tokenVersion: 0 } }),
        revokeAllUserTokens: async () => {},
        ...refreshTokenServiceOverrides,
    })
    withMock('../src/services/password-reset.service', {
        requestPasswordReset: async () => ({ message: 'If the email is registered, a reset link has been sent.' }),
        resetPassword: async () => ({ message: 'Password has been reset successfully' }),
        ...passwordResetServiceOverrides,
    })
    withMock('../src/services/email.service', {
        sendEmail: async () => ({ success: true, provider: 'mock' }),
        sendPasswordResetEmail: async () => ({ success: true, provider: 'mock' }),
        ...emailServiceOverrides,
    })

    for (const [modulePath, exports] of Object.entries(moduleOverrides)) {
        withMock(modulePath, exports)
    }

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

    try {
        const { closeReviewCrawlQueueResources } = require('../src/modules/review-crawl/review-crawl.queue')
        if (typeof closeReviewCrawlQueueResources === 'function') {
            await closeReviewCrawlQueueResources()
        }
    } catch {
        // The queue module is not loaded in every test path.
    }
}

module.exports = {
    createExpiredToken,
    createInvalidToken,
    createTestToken,
    request,
    startApp,
    stopApp,
}
