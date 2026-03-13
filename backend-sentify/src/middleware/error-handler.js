const { Prisma } = require('@prisma/client')
const { AppError } = require('../lib/app-error')
const { sendError } = require('../lib/controller-error')

function logUnhandledError(err, req) {
    const payload = {
        type: 'error_log',
        timestamp: new Date().toISOString(),
        event: 'middleware.unhandled_error',
        requestId: req?.requestId || null,
        method: req?.method || null,
        path: req?.originalUrl || req?.url || null,
        userId: req?.user?.userId || null,
        errorName: err?.name || 'Error',
        message: err?.message || 'Unhandled error',
        stack: err?.stack,
    }

    console.error(JSON.stringify(payload))
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err)
    }

    if (err?.type === 'entity.parse.failed') {
        return sendError(req, res, 400, 'INVALID_JSON', 'Malformed JSON payload')
    }

    if (err?.type === 'entity.too.large') {
        return sendError(req, res, 413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large')
    }

    if (err instanceof AppError) {
        return sendError(req, res, err.statusCode, err.code, err.message, err.details)
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        return sendError(req, res, 400, 'INVALID_REQUEST', 'Request validation failed')
    }

    logUnhandledError(err, req)
    return sendError(req, res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
}

module.exports = errorHandler
