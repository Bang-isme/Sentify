const { createHash, randomBytes } = require('crypto')

const { badRequest, unauthorized } = require('../lib/app-error')
const prisma = require('../lib/prisma')
const emailService = require('./email.service')
const { revokeAllUserTokens } = require('./refresh-token.service')

const bcrypt = require('bcryptjs')

const PASSWORD_SALT_ROUNDS = 12
const RESET_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MINUTES = 30

function hashToken(raw) {
    return createHash('sha256').update(raw).digest('hex')
}

/**
 * Request a password reset. Generates a token, stores the hash, and sends email.
 * Always returns success to avoid email enumeration attacks.
 */
async function requestPasswordReset(email) {
    const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, email: true, fullName: true },
    })

    // Always return success — don't reveal whether the email exists.
    if (!user) {
        return { message: 'If the email is registered, a reset link has been sent.' }
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
    })

    const raw = randomBytes(RESET_TOKEN_BYTES).toString('hex')
    const tokenHash = hashToken(raw)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)

    await prisma.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt,
        },
    })

    await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.fullName,
        resetToken: raw,
    })

    return { message: 'If the email is registered, a reset link has been sent.' }
}

/**
 * Reset password using a valid token.
 * Invalidates token, updates password, revokes all refresh tokens, bumps tokenVersion.
 */
async function resetPassword(token, newPassword) {
    const tokenHash = hashToken(token)

    const resetToken = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true } } },
    })

    if (!resetToken) {
        throw badRequest('INVALID_RESET_TOKEN', 'Reset token is invalid')
    }

    if (resetToken.usedAt) {
        throw badRequest('RESET_TOKEN_USED', 'Reset token has already been used')
    }

    if (resetToken.expiresAt < new Date()) {
        throw badRequest('RESET_TOKEN_EXPIRED', 'Reset token has expired')
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS)

    await prisma.$transaction([
        // Mark token as used
        prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { usedAt: new Date() },
        }),
        // Update password + bump tokenVersion (invalidates all access tokens)
        prisma.user.update({
            where: { id: resetToken.user.id },
            data: {
                passwordHash,
                tokenVersion: { increment: 1 },
                failedLoginCount: 0,
                lockedUntil: null,
            },
        }),
    ])

    // Revoke all refresh tokens for this user
    await revokeAllUserTokens(resetToken.user.id)

    return { message: 'Password has been reset successfully' }
}

module.exports = {
    requestPasswordReset,
    resetPassword,
}
