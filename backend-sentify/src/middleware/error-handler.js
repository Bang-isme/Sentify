const { AppError } = require('../lib/app-error')
const { sendError } = require('../lib/controller-error')

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

    console.error(err)
    return sendError(req, res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
}

module.exports = errorHandler
