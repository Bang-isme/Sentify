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

    if (error instanceof Prisma.PrismaClientValidationError) {
        // Never return raw Prisma validation errors to clients.
        return sendError(req, res, 400, 'INVALID_REQUEST', 'Request validation failed')
    }

    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
    ) {
        return sendError(
            req,
            res,
            409,
            'UNIQUE_CONSTRAINT_FAILED',
            'A unique field already exists',
        )
    }

    logControllerError(error, req)
    return sendError(req, res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
}

module.exports = {
    sendError,
    handleControllerError,
}
