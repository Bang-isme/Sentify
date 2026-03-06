const jwt = require('jsonwebtoken')

function sendUnauthorized(res, code, message) {
    return res.status(401).json({
        error: {
            code,
            message,
        },
    })
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || ''

    if (!authHeader.startsWith('Bearer ')) {
        return sendUnauthorized(res, 'AUTH_MISSING_TOKEN', 'Access token is required')
    }

    const token = authHeader.slice('Bearer '.length)

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.user = payload
        return next()
    } catch (error) {
        return sendUnauthorized(res, 'AUTH_INVALID_TOKEN', 'Access token is invalid or expired')
    }
}

module.exports = authMiddleware
