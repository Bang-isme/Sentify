const { forbidden, unauthorized } = require('../lib/app-error')

function buildUserAccountState(user, now = new Date()) {
    if (user?.deactivatedAt) {
        return 'DEACTIVATED'
    }

    if (user?.manuallyLockedAt) {
        return 'LOCKED'
    }

    if (user?.lockedUntil && user.lockedUntil > now) {
        return 'LOCKED'
    }

    return 'ACTIVE'
}

function assertUserAccountAvailable(user, now = new Date()) {
    const accountState = buildUserAccountState(user, now)

    if (accountState === 'DEACTIVATED') {
        throw forbidden('AUTH_ACCOUNT_DEACTIVATED', 'This account has been deactivated')
    }

    if (accountState === 'LOCKED') {
        throw unauthorized('AUTH_ACCOUNT_LOCKED', 'This account is currently locked')
    }

    return accountState
}

module.exports = {
    assertUserAccountAvailable,
    buildUserAccountState,
}
