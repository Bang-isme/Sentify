const { z } = require('zod')

const { clearAuthCookie, setAuthCookie } = require('../lib/auth-cookie')
const { handleControllerError } = require('../lib/controller-error')
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

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
})

function buildRequestContext(req) {
    return {
        ip: req.ip,
        requestId: req.requestId,
        userAgent: req.get('user-agent') || null,
    }
}

async function register(req, res) {
    try {
        const input = registerSchema.parse(req.body)
        const result = await authService.register(input, buildRequestContext(req))
        setAuthCookie(
            res,
            result.accessToken,
            authService.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000,
        )

        return res.status(201).json({
            data: {
                user: result.user,
                expiresIn: result.expiresIn,
            },
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function login(req, res) {
    try {
        const input = loginSchema.parse(req.body)
        const result = await authService.login(input, buildRequestContext(req))
        setAuthCookie(
            res,
            result.accessToken,
            authService.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000,
        )

        return res.status(200).json({
            data: {
                user: result.user,
                expiresIn: result.expiresIn,
            },
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getSession(req, res) {
    try {
        const result = await authService.getSession({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function logout(req, res) {
    try {
        const result = await authService.logout({
            userId: req.user.userId,
            context: buildRequestContext(req),
        })
        clearAuthCookie(res)

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function changePassword(req, res) {
    try {
        const input = changePasswordSchema.parse(req.body)
        const result = await authService.changePassword({
            userId: req.user.userId,
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
            context: buildRequestContext(req),
        })

        setAuthCookie(
            res,
            result.accessToken,
            authService.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000,
        )

        return res.status(200).json({
            data: {
                user: result.user,
                expiresIn: result.expiresIn,
            },
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    getSession,
    register,
    login,
    logout,
    changePassword,
}
