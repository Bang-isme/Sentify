const http = require('http')
const https = require('https')

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const TRANSIENT_ERROR_CODES = new Set([
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETDOWN',
    'ENETRESET',
    'ENETUNREACH',
    'ENOTFOUND',
    'EPIPE',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
])

function mergeSetCookies(cookieJar, setCookieHeader) {
    const nextJar = { ...cookieJar }
    const setCookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : setCookieHeader
          ? [setCookieHeader]
          : []

    for (const rawCookie of setCookies) {
        const [pair] = String(rawCookie).split(';')
        const separatorIndex = pair.indexOf('=')

        if (separatorIndex === -1) {
            continue
        }

        const name = pair.slice(0, separatorIndex).trim()
        const value = pair.slice(separatorIndex + 1).trim()

        if (!name) {
            continue
        }

        nextJar[name] = value
    }

    return nextJar
}

function buildCookieHeader(cookieJar) {
    return Object.entries(cookieJar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function isTransientRequestError(error) {
    if (!error) {
        return false
    }

    if (TRANSIENT_ERROR_CODES.has(error.code)) {
        return true
    }

    const message = String(error.message || error)
    return /timed out|socket hang up|network|fetch failed/i.test(message)
}

function isRetryableStatus(status) {
    return RETRYABLE_HTTP_STATUSES.has(Number(status))
}

async function requestJson(baseUrl, requestPath, options = {}) {
    const url = new URL(requestPath, baseUrl)
    const method = options.method || 'GET'
    const body = options.body ? JSON.stringify(options.body) : null
    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
    }
    const cookieHeader = buildCookieHeader(options.cookieJar || {})

    if (cookieHeader) {
        headers.Cookie = cookieHeader
    }

    if (body) {
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = Buffer.byteLength(body)
    }

    const effectiveMethod = String(method).toUpperCase()
    if (
        !['GET', 'HEAD', 'OPTIONS'].includes(effectiveMethod) &&
        options.cookieJar?.['XSRF-TOKEN'] &&
        !headers['X-CSRF-Token'] &&
        !headers['x-csrf-token']
    ) {
        headers['X-CSRF-Token'] = options.cookieJar['XSRF-TOKEN']
    }

    const client = url.protocol === 'https:' ? https : http

    return new Promise((resolve, reject) => {
        const req = client.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                method,
                headers,
                rejectUnauthorized: !options.insecureTls,
                agent: options.agent || undefined,
            },
            (res) => {
                let rawBody = ''

                res.on('data', (chunk) => {
                    rawBody += chunk
                })
                res.on('end', () => {
                    let parsedBody = null

                    if (rawBody) {
                        try {
                            parsedBody = JSON.parse(rawBody)
                        } catch (_error) {
                            parsedBody = rawBody
                        }
                    }

                    resolve({
                        status: res.statusCode ?? 0,
                        headers: res.headers,
                        body: parsedBody,
                        cookieJar: mergeSetCookies(
                            options.cookieJar || {},
                            res.headers['set-cookie'],
                        ),
                    })
                })
            },
        )

        req.setTimeout(options.timeoutMs || 15000, () => {
            req.destroy(
                new Error(
                    `Request to ${url.toString()} timed out after ${options.timeoutMs || 15000}ms`,
                ),
            )
        })

        req.on('error', reject)

        if (body) {
            req.write(body)
        }

        req.end()
    })
}

async function requestJsonWithRetries(baseUrl, requestPath, options = {}) {
    const retryAttempts = Number.parseInt(options.retryAttempts || '3', 10)
    const retryDelayMs = Number.parseInt(options.retryDelayMs || '2000', 10)
    const attempts = Number.isNaN(retryAttempts) || retryAttempts < 1 ? 1 : retryAttempts
    const delayMs = Number.isNaN(retryDelayMs) || retryDelayMs < 0 ? 0 : retryDelayMs
    const requestFn = options.requestFn || requestJson
    let lastError = null
    let lastResponse = null

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await requestFn(baseUrl, requestPath, options)
            lastResponse = response

            if (!isRetryableStatus(response.status) || attempt === attempts) {
                return response
            }
        } catch (error) {
            lastError = error

            if (!isTransientRequestError(error) || attempt === attempts) {
                throw error
            }
        }

        if (attempt < attempts && delayMs > 0) {
            await sleep(delayMs * attempt)
        }
    }

    if (lastResponse) {
        return lastResponse
    }

    throw lastError || new Error(`Request to ${requestPath} failed after ${attempts} attempts`)
}

async function warmupStagingBaseUrl(baseUrl, options = {}) {
    const warmupTimeoutMs = Math.min(Number.parseInt(options.timeoutMs || '15000', 10) || 15000, 15000)
    const warmupPaths = ['/health', '/api/health']

    for (const requestPath of warmupPaths) {
        try {
            await requestJsonWithRetries(baseUrl, requestPath, {
                timeoutMs: warmupTimeoutMs,
                insecureTls: options.insecureTls,
                agent: options.agent,
                retryAttempts: options.retryAttempts || 2,
                retryDelayMs: options.retryDelayMs || 1000,
            })
        } catch (_error) {
            // Warmup is best-effort. Login/session requests still perform strict validation.
        }
    }
}

async function loginAndReadSession({
    baseUrl,
    email,
    password,
    timeoutMs,
    insecureTls,
    agent,
    retryAttempts,
    retryDelayMs,
}) {
    await warmupStagingBaseUrl(baseUrl, {
        timeoutMs,
        insecureTls,
        agent,
        retryAttempts,
        retryDelayMs,
    })

    const login = await requestJsonWithRetries(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: {
            email,
            password,
        },
        timeoutMs,
        insecureTls,
        agent,
        retryAttempts,
        retryDelayMs,
    })

    if (login.status !== 200) {
        return {
            passed: false,
            loginStatus: login.status,
            sessionStatus: null,
            cookieJar: login.cookieJar || {},
            session: null,
            cookieNames: Object.keys(login.cookieJar || {}),
            login,
        }
    }

    const session = await requestJsonWithRetries(baseUrl, '/api/auth/session', {
        cookieJar: login.cookieJar,
        timeoutMs,
        insecureTls,
        agent,
        retryAttempts,
        retryDelayMs,
    })

    return {
        passed: session.status === 200,
        loginStatus: login.status,
        sessionStatus: session.status,
        cookieJar: session.cookieJar,
        session: session.body?.data ?? null,
        cookieNames: Object.keys(session.cookieJar || {}),
        login,
    }
}

module.exports = {
    isRetryableStatus,
    isTransientRequestError,
    loginAndReadSession,
    requestJson,
    requestJsonWithRetries,
    sleep,
    warmupStagingBaseUrl,
}
