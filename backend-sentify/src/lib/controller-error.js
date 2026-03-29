const { Prisma } = require('@prisma/client')
const { ZodError } = require('zod')

const { AppError } = require('./app-error')

function logControllerError(error, req) {
    const payload = {
        type: 'error_log',
        timestamp: new Date().toISOString(),
        event: 'controller.unhandled_error',
        requestId: req?.requestId || null,
        method: req?.method || null,
        path: req?.originalUrl || req?.url || null,
        userId: req?.user?.userId || null,
        errorName: error?.name || 'Error',
        message: error?.message || 'Unhandled controller error',
        stack: error?.stack,
    }

    console.error(JSON.stringify(payload))
}

function sendError(req, res, status, code, message, details) {
    return res.status(status).json({
        error: {
            code,
            message,
            timestamp: new Date().toISOString(),
            ...(req?.requestId ? { requestId: req.requestId } : {}),
            ...(details ? { details } : {}),
        },
    })
}

function mapPrismaError(error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
        return {
            status: 400,
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
        }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
        return {
            status: 503,
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database is unavailable',
        }
    }

    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        return null
    }

    switch (error.code) {
        case 'P2002':
            return {
                status: 409,
                code: 'UNIQUE_CONSTRAINT_FAILED',
                message: 'A unique field already exists',
            }
        case 'P2024':
            return {
                status: 503,
                code: 'DATABASE_POOL_EXHAUSTED',
                message: 'Database connection pool is exhausted',
            }
        case 'P2028':
            return {
                status: 503,
                code: 'DATABASE_TRANSACTION_FAILED',
                message: 'Database transaction failed before completion',
            }
        case 'P2034':
            return {
                status: 503,
                code: 'DATABASE_CONCURRENCY_CONFLICT',
                message: 'Database transaction could not complete due to a concurrency conflict',
            }
        default:
            return null
    }
}

function mapTimeoutError(error) {
    if (
        error?.code === 'REQUEST_TIMEOUT' ||
        error?.code === 'ERR_HTTP_REQUEST_TIMEOUT'
    ) {
        return {
            status: 504,
            code: 'REQUEST_TIMEOUT',
            message: 'Request timed out before it could complete',
        }
    }

    return null
}

function mapOperationalError(error) {
    return mapPrismaError(error) || mapTimeoutError(error)
}

function handleControllerError(req, res, error) {
    if (error instanceof ZodError) {
        return sendError(
            req,
            res,
            400,
            'VALIDATION_FAILED',
            'Request validation failed',
            error.issues,
        )
    }

    if (error instanceof SyntaxError && /JSON/i.test(error.message)) {
        return sendError(req, res, 400, 'INVALID_JSON', 'Malformed JSON payload')
    }

    if (error instanceof AppError) {
        return sendError(
            req,
            res,
            error.statusCode,
            error.code,
            error.message,
            error.details,
        )
    }

    const mappedError = mapOperationalError(error)
    if (mappedError) {
        return sendError(
            req,
            res,
            mappedError.status,
            mappedError.code,
            mappedError.message,
        )
    }

    logControllerError(error, req)
    return sendError(req, res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
}

module.exports = {
    mapOperationalError,
    sendError,
    handleControllerError,
}
