const USER_ROLE = Object.freeze({
    USER: 'USER',
    ADMIN: 'ADMIN',
})

const INTERNAL_OPERATOR_ROLES = Object.freeze([USER_ROLE.ADMIN])

function canAccessInternalAdmin(role) {
    return INTERNAL_OPERATOR_ROLES.includes(role)
}

module.exports = {
    USER_ROLE,
    INTERNAL_OPERATOR_ROLES,
    canAccessInternalAdmin,
}
