const jwt = require('jsonwebtoken')

const env = require('../config/env')
const { readAuthCookie } = require('../lib/auth-cookie')
const prisma = require('../lib/prisma')

const AUTH_DB_TIMEOUT_MS = 2000

function sendUnauthorized(req, res, code, message) {
    return res.status(401).json({
        error: {
            code,
            message,
            ...(req?.requestId ? { requestId: req.requestId } : {}),
        },
    })
}

function sendServiceUnavailable(req, res, code, message) {
    return res.status(503).json({
        error: {
            code,
            message,
            ...(req?.requestId ? { requestId: req.requestId } : {}),
        },
    })
}

function extractAccessToken(req) {
    const authHeader = req.headers.authorization || ''

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length)
    }

    return readAuthCookie(req)
}

function withTimeout(promise, timeoutMs, errorCode) {
    let timeoutId = null
    const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
            const timeoutError = new Error('Dependency timeout')
            timeoutError.code = errorCode
            reject(timeoutError)
        }, timeoutMs)
    })

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    })
}

async function authMiddleware(req, res, next) {
    const token = extractAccessToken(req)

    if (!token) {
        return sendUnauthorized(req, res, 'AUTH_MISSING_TOKEN', 'Access token is required')
    }

    try {
        let payload

        try {
            payload = jwt.verify(token, env.JWT_SECRET, {
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            })
        } catch (primaryError) {
            // Fallback to previous secret for zero-downtime rotation
            if (env.JWT_SECRET_PREVIOUS) {
                payload = jwt.verify(token, env.JWT_SECRET_PREVIOUS, {
                    issuer: env.JWT_ISSUER,
                    audience: env.JWT_AUDIENCE,
                })
            } else {
                throw primaryError
            }
        }

        const userId = payload.userId || payload.sub

        if (!userId) {
            return sendUnauthorized(req, res, 'AUTH_INVALID_TOKEN', 'Access token is invalid')
        }

        // MVP safeguard: guard against hung DB calls until we have full dependency timeouts.
        const user = await withTimeout(
            prisma.user.findUnique({
                where: {
                    id: userId,
                },
                select: {
                    id: true,
                    tokenVersion: true,
                },
            }),
            AUTH_DB_TIMEOUT_MS,
            'AUTH_DB_TIMEOUT',
        )

        if (!user || payload.tokenVersion !== user.tokenVersion) {
            return sendUnauthorized(req, res, 'AUTH_REVOKED_TOKEN', 'Access token has been revoked')
        }

        req.user = {
            userId: user.id,
            tokenVersion: payload.tokenVersion,
            jti: payload.jti || null,
        }
        return next()
    } catch (error) {
        if (error.code === 'AUTH_DB_TIMEOUT') {
            return sendServiceUnavailable(
                req,
                res,
                'AUTH_DEPENDENCY_TIMEOUT',
                'Authentication service is temporarily unavailable',
            )
        }

        if (error.name === 'TokenExpiredError') {
            return sendUnauthorized(req, res, 'AUTH_TOKEN_EXPIRED', 'Access token has expired')
        }

        return sendUnauthorized(
            req,
            res,
            'AUTH_INVALID_TOKEN',
            'Access token is invalid or expired',
        )
    }
}

module.exports = authMiddleware
