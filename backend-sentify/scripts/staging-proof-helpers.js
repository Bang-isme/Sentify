const http = require('http')
const https = require('https')

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

async function loginAndReadSession({
    baseUrl,
    email,
    password,
    timeoutMs,
    insecureTls,
    agent,
}) {
    const login = await requestJson(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: {
            email,
            password,
        },
        timeoutMs,
        insecureTls,
        agent,
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

    const session = await requestJson(baseUrl, '/api/auth/session', {
        cookieJar: login.cookieJar,
        timeoutMs,
        insecureTls,
        agent,
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
    loginAndReadSession,
    requestJson,
}
