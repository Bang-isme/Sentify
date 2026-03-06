const jwt = require('jsonwebtoken')

function sendUnauthorized(req, res, code, message) {
    return res.status(401).json({
        error: {
            code,
            message,
            ...(req?.requestId ? { requestId: req.requestId } : {}),
        },
    })
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || ''

    if (!authHeader.startsWith('Bearer ')) {
        return sendUnauthorized(req, res, 'AUTH_MISSING_TOKEN', 'Access token is required')
    }

    const token = authHeader.slice('Bearer '.length)

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.user = payload
        return next()
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return sendUnauthorized(req, res, 'AUTH_TOKEN_EXPIRED', 'Access token has expired')
        }

        return sendUnauthorized(
            req,
            res,
            'AUTH_INVALID_TOKEN',
            'Access token is invalid or expired',
        )
    }
}

module.exports = authMiddleware
