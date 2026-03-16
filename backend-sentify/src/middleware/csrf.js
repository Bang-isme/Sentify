const { randomBytes } = require('crypto')

const env = require('../config/env')

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Double Submit Cookie CSRF protection.
 *
 * How it works:
 * 1. On login/register, server sets a non-httpOnly XSRF-TOKEN cookie.
 * 2. Frontend reads this cookie and sends it in X-CSRF-Token header.
 * 3. This middleware validates that the header matches the cookie.
 *
 * Only applies to cookie-based auth. Requests with Bearer token are exempt
 * because the attacker cannot read the token from a cross-origin context.
 */
function csrfProtection(req, res, next) {
    // Safe methods don't change state — skip.
    if (SAFE_METHODS.has(req.method)) {
        return next()
    }

    // If the request uses Bearer auth, CSRF is not needed (token already proves intent).
    const authHeader = req.headers.authorization || ''
    if (authHeader.startsWith('Bearer ')) {
        return next()
    }

    // If there's no auth cookie, skip (public endpoints like login/register).
    const cookieHeader = req.headers.cookie || ''
    if (!cookieHeader.includes(env.AUTH_COOKIE_NAME)) {
        return next()
    }

    // Validate double-submit: header must match cookie.
    const csrfCookie = extractCookieValue(cookieHeader, CSRF_COOKIE_NAME)
    const csrfHeader = req.headers[CSRF_HEADER_NAME]

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({
            error: {
                code: 'CSRF_VALIDATION_FAILED',
                message: 'CSRF token is missing or invalid',
                timestamp: new Date().toISOString(),
            },
        })
    }

    return next()
}

function extractCookieValue(cookieHeader, name) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
}

/**
 * Generate and set the CSRF cookie. Call this after login/register.
 */
function setCsrfCookie(res) {
    const token = randomBytes(32).toString('hex')

    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Frontend needs to read this
        sameSite: env.AUTH_COOKIE_SAME_SITE,
        secure: env.AUTH_COOKIE_SECURE_VALUE,
        path: '/',
        ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
    })

    return token
}

function clearCsrfCookie(res) {
    res.clearCookie(CSRF_COOKIE_NAME, {
        httpOnly: false,
        sameSite: env.AUTH_COOKIE_SAME_SITE,
        secure: env.AUTH_COOKIE_SECURE_VALUE,
        path: '/',
        ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
    })
}

module.exports = {
    csrfProtection,
    setCsrfCookie,
    clearCsrfCookie,
}
