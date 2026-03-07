const env = require('../config/env')

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    red: '\x1b[31m',
}

function getLogMethod(statusCode, aborted) {
    if (aborted || statusCode >= 500) {
        return console.error
    }

    if (statusCode >= 400) {
        return console.warn
    }

    return console.info
}

function sanitizePath(url) {
    if (!url) {
        return '/'
    }

    const [path] = String(url).split('?')
    return path || '/'
}

function sanitizeUserAgent(userAgent) {
    if (!userAgent) {
        return null
    }

    return String(userAgent).slice(0, 200)
}

function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
        return text
    }

    return `${text.slice(0, maxLength - 3)}...`
}

function shortId(value) {
    if (!value) {
        return null
    }

    return String(value).slice(0, 8)
}

function toDurationMs(startTime) {
    const durationNs = process.hrtime.bigint() - startTime
    return Number((durationNs * 1000n) / 1000000n) / 1000
}

function shouldUsePrettyLogs() {
    if (env.LOG_FORMAT === 'pretty') {
        return true
    }

    if (env.LOG_FORMAT === 'json') {
        return false
    }

    return env.NODE_ENV === 'development' && process.stdout.isTTY
}

function shouldUseColor() {
    if (process.env.NO_COLOR) {
        return false
    }

    if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') {
        return true
    }

    return shouldUsePrettyLogs() && process.stdout.isTTY
}

function colorize(text, ...styles) {
    if (!shouldUseColor()) {
        return text
    }

    return `${styles.join('')}${text}${ANSI.reset}`
}

function getStatusStyle(statusCode) {
    if (statusCode >= 500) {
        return [ANSI.bold, ANSI.red]
    }

    if (statusCode >= 400) {
        return [ANSI.bold, ANSI.yellow]
    }

    return [ANSI.bold, ANSI.green]
}

function getMethodStyle(method) {
    switch (method) {
        case 'POST':
            return [ANSI.bold, ANSI.cyan]
        case 'PATCH':
            return [ANSI.bold, ANSI.blue]
        case 'DELETE':
            return [ANSI.bold, ANSI.red]
        case 'PUT':
            return [ANSI.bold, ANSI.magenta]
        default:
            return [ANSI.bold, ANSI.green]
    }
}

function getDurationStyle(durationMs) {
    if (durationMs >= 1000) {
        return [ANSI.bold, ANSI.red]
    }

    if (durationMs >= 500) {
        return [ANSI.bold, ANSI.yellow]
    }

    return [ANSI.dim, ANSI.gray]
}

function formatPrettyLog(payload) {
    const level = payload.statusCode >= 500 ? 'ERR' : payload.statusCode >= 400 ? 'WARN' : 'HTTP'
    const time = payload.timestamp.slice(11, 19)
    const parts = [
        colorize(`[${time}]`, ANSI.dim, ANSI.gray),
        colorize(`[${level} ${payload.statusCode}]`, ...getStatusStyle(payload.statusCode)),
        `${colorize(payload.method, ...getMethodStyle(payload.method))} ${colorize(payload.path, ANSI.bold)}`,
        colorize(`${payload.durationMs.toFixed(1)}ms`, ...getDurationStyle(payload.durationMs)),
    ]

    if (payload.requestId) {
        parts.push(colorize(`req=${shortId(payload.requestId)}`, ANSI.dim, ANSI.gray))
    }

    if (payload.userId) {
        parts.push(colorize(`user=${shortId(payload.userId)}`, ANSI.dim, ANSI.gray))
    }

    if (payload.ip) {
        parts.push(colorize(`ip=${payload.ip}`, ANSI.dim, ANSI.gray))
    }

    if (payload.responseBytes) {
        parts.push(colorize(`${payload.responseBytes}b`, ANSI.dim, ANSI.gray))
    }

    if (payload.userAgent) {
        parts.push(
            colorize(`ua="${truncate(payload.userAgent, 72)}"`, ANSI.dim, ANSI.gray),
        )
    }

    return parts.join(' ')
}

function requestLogger(req, res, next) {
    if (env.NODE_ENV === 'test') {
        return next()
    }

    const startTime = process.hrtime.bigint()
    let flushed = false

    function flush(aborted) {
        if (flushed) {
            return
        }

        flushed = true

        const payload = {
            type: 'request_log',
            timestamp: new Date().toISOString(),
            event: aborted ? 'http.request.aborted' : 'http.request.completed',
            requestId: req.requestId || null,
            method: req.method,
            path: sanitizePath(req.originalUrl || req.url || req.path),
            request: `${req.method} ${sanitizePath(req.originalUrl || req.url || req.path)}`,
            statusCode: res.statusCode,
            durationMs: toDurationMs(startTime),
            ip: req.ip || null,
            userAgent: sanitizeUserAgent(req.get('user-agent')),
            ...(req.user?.userId ? { userId: req.user.userId } : {}),
            ...(res.getHeader('content-length')
                ? { responseBytes: Number(res.getHeader('content-length')) || 0 }
                : {}),
        }

        const log = getLogMethod(res.statusCode, aborted)
        log(shouldUsePrettyLogs() ? formatPrettyLog(payload) : JSON.stringify(payload))
    }

    res.once('finish', () => {
        flush(false)
    })

    res.once('close', () => {
        if (!res.writableEnded) {
            flush(true)
        }
    })

    return next()
}

module.exports = requestLogger
