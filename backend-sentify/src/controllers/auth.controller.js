const { z } = require('zod')

const { clearAuthCookie, clearRefreshCookie, readRefreshCookie, setAuthCookie, setRefreshCookie } = require('../lib/auth-cookie')
const { handleControllerError } = require('../lib/controller-error')
const authService = require('../services/auth.service')
const passwordResetService = require('../services/password-reset.service')
const refreshTokenService = require('../services/refresh-token.service')

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

const forgotPasswordSchema = z.object({
    email: z.email().trim().toLowerCase(),
})

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
})

function buildRequestContext(req) {
    return {
        ip: req.ip,
        requestId: req.requestId,
        userAgent: req.get('user-agent') || null,
    }
}

function setTokenCookies(res, result) {
    setAuthCookie(res, result.accessToken, authService.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000)

    if (result.refreshToken) {
        setRefreshCookie(res, result.refreshToken)
    }
}

async function register(req, res) {
    try {
        const input = registerSchema.parse(req.body)
        const result = await authService.register(input, buildRequestContext(req))
        setTokenCookies(res, result)

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
        setTokenCookies(res, result)

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
        clearRefreshCookie(res)

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

        setTokenCookies(res, result)

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

async function refresh(req, res) {
    try {
        // Read refresh token from cookie or body
        const rawToken = readRefreshCookie(req) || req.body?.refreshToken

        if (!rawToken) {
            return res.status(401).json({
                error: {
                    code: 'AUTH_MISSING_REFRESH_TOKEN',
                    message: 'Refresh token is required',
                    timestamp: new Date().toISOString(),
                },
            })
        }

        const { newRawToken, user } = await refreshTokenService.rotateRefreshToken(rawToken)
        const accessToken = authService.buildAccessToken(user)

        setAuthCookie(res, accessToken, authService.ACCESS_TOKEN_EXPIRES_IN_SECONDS * 1000)
        setRefreshCookie(res, newRawToken)

        return res.status(200).json({
            data: {
                expiresIn: authService.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
            },
        })
    } catch (error) {
        // On any refresh error, clear cookies so the user is forced to re-login
        clearAuthCookie(res)
        clearRefreshCookie(res)
        return handleControllerError(req, res, error)
    }
}

async function forgotPassword(req, res) {
    try {
        const input = forgotPasswordSchema.parse(req.body)
        const result = await passwordResetService.requestPasswordReset(input.email)

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function resetPassword(req, res) {
    try {
        const input = resetPasswordSchema.parse(req.body)
        const result = await passwordResetService.resetPassword(input.token, input.newPassword)

        clearAuthCookie(res)
        clearRefreshCookie(res)

        return res.status(200).json({
            data: result,
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
    refresh,
    forgotPassword,
    resetPassword,
}
