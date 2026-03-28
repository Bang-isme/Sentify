const express = require('express')

const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./admin-restaurants.controller')

const router = express.Router()
const validateId = validateUuidParam('id')
const validateSubmissionId = validateUuidParam('submissionId')

router.get('/restaurants', controller.listAdminRestaurants)
router.get('/restaurants/source-submissions', controller.listAdminSourceSubmissions)
router.post(
    '/restaurants/source-submissions/claim-next',
    controller.claimNextSourceSubmissionGroup,
)
router.post(
    '/restaurants/source-submissions/:submissionId/resolve',
    validateSubmissionId,
    controller.resolveAdminSourceSubmission,
)
router.post(
    '/restaurants/source-submissions/:submissionId/create-source',
    validateSubmissionId,
    controller.createSourceFromSubmission,
)
router.post(
    '/restaurants/source-submissions/:submissionId/scheduling-lane',
    validateSubmissionId,
    controller.updateSourceSubmissionSchedulingLane,
)
router.patch(
    '/restaurants/:id/entitlement',
    validateId,
    controller.updateRestaurantEntitlement,
)
router.get('/restaurants/:id', validateId, controller.getAdminRestaurantDetail)

module.exports = router
