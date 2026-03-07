const jwt = require('jsonwebtoken')

const env = require('../config/env')
const { readAuthCookie } = require('../lib/auth-cookie')
const prisma = require('../lib/prisma')

function sendUnauthorized(req, res, code, message) {
    return res.status(401).json({
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

async function authMiddleware(req, res, next) {
    const token = extractAccessToken(req)

    if (!token) {
        return sendUnauthorized(req, res, 'AUTH_MISSING_TOKEN', 'Access token is required')
    }

    try {
        const payload = jwt.verify(token, env.JWT_SECRET, {
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
        })
        const userId = payload.userId || payload.sub

        if (!userId) {
            return sendUnauthorized(req, res, 'AUTH_INVALID_TOKEN', 'Access token is invalid')
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                tokenVersion: true,
            },
        })

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
