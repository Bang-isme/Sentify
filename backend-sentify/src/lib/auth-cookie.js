const env = require('../config/env')

function parseCookieHeader(headerValue) {
    if (!headerValue) {
        return {}
    }

    return headerValue
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce((cookies, entry) => {
            const separatorIndex = entry.indexOf('=')

            if (separatorIndex <= 0) {
                return cookies
            }

            const name = entry.slice(0, separatorIndex).trim()
            const rawValue = entry.slice(separatorIndex + 1)

            cookies[name] = decodeURIComponent(rawValue)
            return cookies
        }, {})
}

function getBaseCookieOptions() {
    return {
        httpOnly: true,
        sameSite: env.AUTH_COOKIE_SAME_SITE,
        secure: env.AUTH_COOKIE_SECURE_VALUE,
        path: '/',
        ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
    }
}

function readAuthCookie(req) {
    const cookies = parseCookieHeader(req.headers.cookie || '')
    return cookies[env.AUTH_COOKIE_NAME] || null
}

function setAuthCookie(res, token, maxAgeMs) {
    res.cookie(env.AUTH_COOKIE_NAME, token, {
        ...getBaseCookieOptions(),
        maxAge: maxAgeMs,
    })
}

function clearAuthCookie(res) {
    res.clearCookie(env.AUTH_COOKIE_NAME, getBaseCookieOptions())
}

module.exports = {
    clearAuthCookie,
    readAuthCookie,
    setAuthCookie,
}
