const { handleControllerError } = require('../../lib/controller-error')
const { validateUuidParam } = require('../../middleware/validate-uuid')
const service = require('./admin-access.service')
const {
    createUserSchema,
    createMembershipSchema,
    listMembershipsQuerySchema,
    listUsersQuerySchema,
    updateUserAccountStateSchema,
    updateUserRoleSchema,
} = require('./admin-access.validation')

const validateUserId = validateUuidParam('id')
const validateMembershipId = validateUuidParam('id')

async function listUsers(req, res) {
    try {
        const filters = listUsersQuerySchema.parse(req.query)
        const result = await service.listAdminUsers({
            userId: req.user.userId,
            filters,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getUserDetail(req, res) {
    try {
        const result = await service.getAdminUserDetail({
            userId: req.user.userId,
            targetUserId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function createUser(req, res) {
    try {
        const input = createUserSchema.parse(req.body)
        const result = await service.createAdminUser({
            userId: req.user.userId,
            input,
        })

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateUserRole(req, res) {
    try {
        const input = updateUserRoleSchema.parse(req.body)
        const result = await service.updateAdminUserRole({
            userId: req.user.userId,
            targetUserId: req.params.id,
            role: input.role,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateUserAccountState(req, res) {
    try {
        const input = updateUserAccountStateSchema.parse(req.body)
        const result = await service.updateAdminUserAccountState({
            userId: req.user.userId,
            targetUserId: req.params.id,
            action: input.action,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function triggerPasswordReset(req, res) {
    try {
        const result = await service.triggerAdminPasswordReset({
            userId: req.user.userId,
            targetUserId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function listMemberships(req, res) {
    try {
        const filters = listMembershipsQuerySchema.parse(req.query)
        const result = await service.listMemberships({
            userId: req.user.userId,
            filters,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function createMembership(req, res) {
    try {
        const input = createMembershipSchema.parse(req.body)
        const result = await service.createMembership({
            userId: req.user.userId,
            input,
        })

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function deleteMembership(req, res) {
    try {
        const result = await service.deleteMembership({
            userId: req.user.userId,
            membershipId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    createUser,
    createMembership,
    deleteMembership,
    getUserDetail,
    listMemberships,
    listUsers,
    triggerPasswordReset,
    updateUserAccountState,
    updateUserRole,
    validateMembershipId,
    validateUserId,
}
