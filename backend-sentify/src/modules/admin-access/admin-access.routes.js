const express = require('express')

const controller = require('./admin-access.controller')

const router = express.Router()

router.get('/users', controller.listUsers)
router.post('/users', controller.createUser)
router.get('/users/:id', controller.validateUserId, controller.getUserDetail)
router.patch('/users/:id/role', controller.validateUserId, controller.updateUserRole)
router.patch(
    '/users/:id/account-state',
    controller.validateUserId,
    controller.updateUserAccountState,
)
router.post(
    '/users/:id/password-reset',
    controller.validateUserId,
    controller.triggerPasswordReset,
)

router.get('/memberships', controller.listMemberships)
router.post('/memberships', controller.createMembership)
router.delete(
    '/memberships/:id',
    controller.validateMembershipId,
    controller.deleteMembership,
)

module.exports = router
