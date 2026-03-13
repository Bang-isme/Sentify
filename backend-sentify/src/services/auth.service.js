const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const jwt = require('jsonwebtoken')

const env = require('../config/env')
const { badRequest, conflict, tooManyRequests, unauthorized } = require('../lib/app-error')
const prisma = require('../lib/prisma')
const { logSecurityEvent } = require('../lib/security-event')

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60
const PASSWORD_SALT_ROUNDS = 12

function getJwtSecret() {
    return env.JWT_SECRET
}

function buildAccessToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            tokenVersion: user.tokenVersion,
        },
        getJwtSecret(),
        {
            expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
            subject: user.id,
            jwtid: randomUUID(),
        },
    )
}

function normalizeEmail(email) {
    // Normalize once so uniqueness and login checks do not depend on client casing.
    return email.trim().toLowerCase()
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000)
}

function mapRestaurants(memberships) {
    return memberships.map((membership) => ({
        id: membership.restaurant.id,
        name: membership.restaurant.name,
        slug: membership.restaurant.slug,
        permission: membership.permission,
    }))
}

async function register(input, context = {}) {
    const email = normalizeEmail(input.email)
    const existingUser = await prisma.user.findUnique({
        where: { email },
    })

    if (existingUser) {
        throw conflict('EMAIL_ALREADY_EXISTS', 'Email already exists')
    }

    // Store only the bcrypt hash; the raw password should never reach the database.
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS)
    const user = await prisma.user.create({
        data: {
            email,
            fullName: input.fullName.trim(),
            passwordHash,
        },
    })

    logSecurityEvent('auth.register.success', {
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
        userId: user.id,
        email: user.email,
    })

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
        },
        accessToken: buildAccessToken(user),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    }
}

async function login(input, context = {}) {
    const email = normalizeEmail(input.email)
    // Login returns the user's restaurant memberships so the frontend can branch straight into picker/dashboard flow.
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            restaurants: {
                include: {
                    restaurant: true,
                },
            },
        },
    })

    const now = new Date()

    if (user?.lockedUntil && user.lockedUntil > now) {
        logSecurityEvent('auth.login.locked', {
            requestId: context.requestId,
            ip: context.ip,
            userAgent: context.userAgent,
            userId: user.id,
            email,
            lockedUntil: user.lockedUntil.toISOString(),
        })

        throw tooManyRequests(
            'AUTH_RATE_LIMITED',
            'Too many failed login attempts. Please try again later.',
        )
    }

    if (!user) {
        logSecurityEvent('auth.login.failed', {
            requestId: context.requestId,
            ip: context.ip,
            userAgent: context.userAgent,
            email,
            reason: 'user_not_found',
        })
        throw unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash)

    if (!isPasswordValid) {
        const nextFailedLoginCount = user.failedLoginCount + 1
        const shouldLock = nextFailedLoginCount >= env.LOGIN_LOCK_THRESHOLD
        const lockedUntil = shouldLock ? addMinutes(now, env.LOGIN_LOCK_MINUTES) : null

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                failedLoginCount: shouldLock ? 0 : nextFailedLoginCount,
                lockedUntil,
            },
        })

        logSecurityEvent(shouldLock ? 'auth.login.locked' : 'auth.login.failed', {
            requestId: context.requestId,
            ip: context.ip,
            userAgent: context.userAgent,
            userId: user.id,
            email,
            reason: 'invalid_password',
            ...(lockedUntil ? { lockedUntil: lockedUntil.toISOString() } : {}),
        })

        if (shouldLock) {
            throw tooManyRequests(
                'AUTH_RATE_LIMITED',
                'Too many failed login attempts. Please try again later.',
            )
        }

        throw unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
    }

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: now,
        },
    })

    logSecurityEvent('auth.login.success', {
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
        userId: user.id,
        email,
    })

    return {
        accessToken: buildAccessToken(user),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            restaurants: mapRestaurants(user.restaurants),
        },
    }
}

async function logout({ userId, context = {} }) {
    await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            tokenVersion: {
                increment: 1,
            },
        },
    })

    logSecurityEvent('auth.logout', {
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
        userId,
    })

    return {
        message: 'Logged out successfully',
    }
}

async function getSession({ userId }) {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            restaurants: {
                include: {
                    restaurant: true,
                },
            },
        },
    })

    if (!user) {
        throw unauthorized('AUTH_INVALID_TOKEN', 'Access token is invalid or expired')
    }

    return {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            restaurants: mapRestaurants(user.restaurants),
        },
    }
}

async function changePassword({ userId, currentPassword, newPassword, context = {} }) {
    if (currentPassword === newPassword) {
        throw badRequest('AUTH_PASSWORD_REUSE', 'New password must be different')
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!user) {
        throw unauthorized('AUTH_INVALID_TOKEN', 'Access token is invalid or expired')
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)

    if (!isPasswordValid) {
        logSecurityEvent('auth.password.change.failed', {
            requestId: context.requestId,
            ip: context.ip,
            userAgent: context.userAgent,
            userId,
            reason: 'invalid_password',
        })
        throw unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid current password')
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS)
    const updatedUser = await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            passwordHash,
            tokenVersion: {
                increment: 1,
            },
            failedLoginCount: 0,
            lockedUntil: null,
        },
        select: {
            id: true,
            email: true,
            fullName: true,
            tokenVersion: true,
        },
    })

    logSecurityEvent('auth.password.changed', {
        requestId: context.requestId,
        ip: context.ip,
        userAgent: context.userAgent,
        userId: updatedUser.id,
        email: updatedUser.email,
    })

    return {
        accessToken: buildAccessToken(updatedUser),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        user: {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
        },
    }
}

module.exports = {
    ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    getSession,
    register,
    login,
    logout,
    changePassword,
}
