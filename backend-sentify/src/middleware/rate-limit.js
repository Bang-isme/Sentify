const rateLimit = require('express-rate-limit')

const env = require('../config/env')
const { sendError } = require('../lib/controller-error')

function createJsonLimiter({
    windowMs,
    max,
    code,
    message,
    keyGenerator,
    skipSuccessfulRequests,
}) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        skipSuccessfulRequests,
        handler: (req, res) => sendError(req, res, 429, code, message),
    })
}

const apiLimiter = createJsonLimiter({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    max: env.API_RATE_LIMIT_MAX,
    code: 'API_RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
})

const loginLimiter = createJsonLimiter({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    code: 'AUTH_RATE_LIMITED',
    message: 'Too many login attempts. Please try again later.',
    skipSuccessfulRequests: true,
})

const registerLimiter = createJsonLimiter({
    windowMs: env.REGISTER_RATE_LIMIT_WINDOW_MS,
    max: env.REGISTER_RATE_LIMIT_MAX,
    code: 'AUTH_RATE_LIMITED',
    message: 'Too many registration attempts. Please try again later.',
})

const passwordChangeLimiter = createJsonLimiter({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    code: 'AUTH_RATE_LIMITED',
    message: 'Too many password change attempts. Please try again later.',
    skipSuccessfulRequests: true,
})

module.exports = {
    apiLimiter,
    loginLimiter,
    passwordChangeLimiter,
    registerLimiter,
}
