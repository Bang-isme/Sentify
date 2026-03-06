const { Prisma } = require('@prisma/client')
const { ZodError } = require('zod')

const { AppError } = require('./app-error')

function sendError(req, res, status, code, message, details) {
    return res.status(status).json({
        error: {
            code,
            message,
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

    console.error(error)
    return sendError(req, res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
}

module.exports = {
    sendError,
    handleControllerError,
}
