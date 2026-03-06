const { ZodError, z } = require('zod')

const authService = require('../services/auth.service')

const registerSchema = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    fullName: z.string().trim().min(1, 'Full name is required').max(100),
})

const loginSchema = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1, 'Password is required'),
})

function sendError(res, status, code, message, details) {
    return res.status(status).json({
        error: {
            code,
            message,
            ...(details ? { details } : {}),
        },
    })
}

function handleAuthError(res, error) {
    if (error instanceof ZodError) {
        return sendError(res, 400, 'VALIDATION_FAILED', 'Request validation failed', error.issues)
    }

    if (error.code === 'EMAIL_ALREADY_EXISTS') {
        return sendError(res, 409, 'EMAIL_ALREADY_EXISTS', error.message)
    }

    if (error.code === 'AUTH_INVALID_CREDENTIALS') {
        return sendError(res, 401, 'AUTH_INVALID_CREDENTIALS', error.message)
    }

    if (error.code === 'AUTH_MISSING_TOKEN' || error.code === 'AUTH_INVALID_TOKEN') {
        return sendError(res, 401, error.code, error.message)
    }

    console.error(error)
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
}

async function register(req, res) {
    try {
        const input = registerSchema.parse(req.body)
        const result = await authService.register(input)

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleAuthError(res, error)
    }
}

async function login(req, res) {
    try {
        const input = loginSchema.parse(req.body)
        const result = await authService.login(input)

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleAuthError(res, error)
    }
}

async function logout(req, res) {
    try {
        return res.status(200).json({
            data: {
                message: 'Logged out successfully',
            },
        })
    } catch (error) {
        return handleAuthError(res, error)
    }
}

module.exports = {
    register,
    login,
    logout,
}
