class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message)
        this.name = 'AppError'
        this.statusCode = statusCode
        this.code = code
        this.details = details
    }
}

function badRequest(code, message, details) {
    return new AppError(400, code, message, details)
}

function unauthorized(code, message, details) {
    return new AppError(401, code, message, details)
}

function forbidden(code, message, details) {
    return new AppError(403, code, message, details)
}

function notFound(code, message, details) {
    return new AppError(404, code, message, details)
}

function conflict(code, message, details) {
    return new AppError(409, code, message, details)
}

function tooManyRequests(code, message, details) {
    return new AppError(429, code, message, details)
}

function badGateway(code, message, details) {
    return new AppError(502, code, message, details)
}

function serviceUnavailable(code, message, details) {
    return new AppError(503, code, message, details)
}

module.exports = {
    AppError,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    tooManyRequests,
    badGateway,
    serviceUnavailable,
}
