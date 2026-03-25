const { forbidden } = require('../lib/app-error')

function normalizeRoles(allowedRoles) {
    if (!allowedRoles) {
        return []
    }

    return Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
}

function requireUserRole(allowedRoles) {
    const normalizedRoles = normalizeRoles(allowedRoles)

    return function requireUserRoleMiddleware(req, res, next) {
        try {
            const currentRole = req.user?.role || 'USER'

            if (!normalizedRoles.includes(currentRole)) {
                throw forbidden('FORBIDDEN', 'You do not have access to this role-specific action')
            }

            return next()
        } catch (error) {
            return next(error)
        }
    }
}

module.exports = requireUserRole
