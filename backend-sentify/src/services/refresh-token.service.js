const { createHash, randomBytes } = require('crypto')

const { unauthorized } = require('../lib/app-error')
const prisma = require('../lib/prisma')

const REFRESH_TOKEN_BYTES = 32
const REFRESH_TOKEN_TTL_DAYS = 7

function hashToken(raw) {
    return createHash('sha256').update(raw).digest('hex')
}

function generateRawToken() {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
}

function refreshTokenExpiresAt() {
    const date = new Date()
    date.setDate(date.getDate() + REFRESH_TOKEN_TTL_DAYS)
    return date
}

/**
 * Create a new refresh token for a user, starting a new token family.
 * Returns the raw (unhashed) token — this is the only time it's available.
 */
async function createRefreshToken(userId) {
    const raw = generateRawToken()
    const tokenHash = hashToken(raw)
    const familyId = randomBytes(16).toString('hex')

    await prisma.refreshToken.create({
        data: {
            userId,
            tokenHash,
            familyId,
            expiresAt: refreshTokenExpiresAt(),
        },
    })

    return { raw, familyId }
}

/**
 * Rotate: verify the old refresh token, revoke it, issue a new one in the same family.
 * If the old token was already revoked → reuse detected → revoke entire family.
 */
async function rotateRefreshToken(rawToken) {
    const tokenHash = hashToken(rawToken)

    const existing = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, tokenVersion: true } } },
    })

    if (!existing) {
        throw unauthorized('AUTH_INVALID_REFRESH_TOKEN', 'Refresh token is invalid')
    }

    // Reuse detection: if this token was already revoked, someone stole it.
    // Revoke the entire family to protect the user.
    if (existing.revokedAt) {
        await prisma.refreshToken.updateMany({
            where: { familyId: existing.familyId },
            data: { revokedAt: new Date() },
        })

        throw unauthorized('AUTH_REFRESH_TOKEN_REUSE', 'Refresh token reuse detected — all sessions revoked')
    }

    if (existing.expiresAt < new Date()) {
        throw unauthorized('AUTH_REFRESH_TOKEN_EXPIRED', 'Refresh token has expired')
    }

    // Revoke old token + create new one in the same family (atomic)
    const newRaw = generateRawToken()
    const newTokenHash = hashToken(newRaw)

    await prisma.$transaction([
        prisma.refreshToken.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() },
        }),
        prisma.refreshToken.create({
            data: {
                userId: existing.userId,
                tokenHash: newTokenHash,
                familyId: existing.familyId,
                expiresAt: refreshTokenExpiresAt(),
            },
        }),
    ])

    return {
        newRawToken: newRaw,
        userId: existing.userId,
        user: existing.user,
    }
}

/**
 * Revoke all refresh tokens for a user (e.g. on password change, account compromise).
 */
async function revokeAllUserTokens(userId) {
    await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    })
}

module.exports = {
    REFRESH_TOKEN_TTL_DAYS,
    createRefreshToken,
    rotateRefreshToken,
    revokeAllUserTokens,
}
