const prisma = require('../lib/prisma')
const { forbidden, unauthorized } = require('../lib/app-error')
const { assertUserAccountAvailable } = require('./user-account-state.service')

function normalizeRoles(allowedRoles) {
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return null
    }

    return new Set(allowedRoles)
}

async function getUserRoleAccess({ userId, allowedRoles }) {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            lockedUntil: true,
            manuallyLockedAt: true,
            deactivatedAt: true,
        },
    })

    if (!user) {
        throw unauthorized('AUTH_INVALID_TOKEN', 'Access token is invalid or expired')
    }

    const roleSet = normalizeRoles(allowedRoles)
    const effectiveRole = user.role || 'USER'

    assertUserAccountAvailable(user)

    if (roleSet && !roleSet.has(effectiveRole)) {
        throw forbidden('FORBIDDEN', 'You do not have access to this internal action')
    }

    return {
        ...user,
        role: effectiveRole,
    }
}

module.exports = {
    getUserRoleAccess,
}
