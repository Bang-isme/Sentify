const { handleControllerError } = require('../../lib/controller-error')
const service = require('./admin-restaurants.service')
const {
    claimNextSourceSubmissionSchema,
    createSourceFromSubmissionSchema,
    resolveSourceSubmissionSchema,
    updateRestaurantEntitlementSchema,
    updateSourceSubmissionSchedulingLaneSchema,
} = require('./admin-restaurants.validation')

async function listAdminRestaurants(req, res) {
    try {
        const result = await service.listAdminRestaurants({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function listAdminSourceSubmissions(req, res) {
    try {
        const result = await service.listAdminSourceSubmissions({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function claimNextSourceSubmissionGroup(req, res) {
    try {
        const input = claimNextSourceSubmissionSchema.parse(req.body ?? {})
        const result = await service.claimNextSourceSubmissionGroup({
            userId: req.user.userId,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function resolveAdminSourceSubmission(req, res) {
    try {
        const input = resolveSourceSubmissionSchema.parse(req.body ?? {})
        const result = await service.resolveAdminSourceSubmission({
            userId: req.user.userId,
            submissionId: req.params.submissionId,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function createSourceFromSubmission(req, res) {
    try {
        const input = createSourceFromSubmissionSchema.parse(req.body ?? {})
        const result = await service.createSourceFromSubmission({
            userId: req.user.userId,
            submissionId: req.params.submissionId,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateSourceSubmissionSchedulingLane(req, res) {
    try {
        const input = updateSourceSubmissionSchedulingLaneSchema.parse(req.body ?? {})
        const result = await service.updateSourceSubmissionSchedulingLane({
            userId: req.user.userId,
            submissionId: req.params.submissionId,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getAdminRestaurantDetail(req, res) {
    try {
        const result = await service.getAdminRestaurantDetail({
            userId: req.user.userId,
            restaurantId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateRestaurantEntitlement(req, res) {
    try {
        const input = updateRestaurantEntitlementSchema.parse(req.body ?? {})
        const result = await service.updateRestaurantEntitlement({
            userId: req.user.userId,
            restaurantId: req.params.id,
            input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    claimNextSourceSubmissionGroup,
    createSourceFromSubmission,
    getAdminRestaurantDetail,
    listAdminSourceSubmissions,
    listAdminRestaurants,
    resolveAdminSourceSubmission,
    updateRestaurantEntitlement,
    updateSourceSubmissionSchedulingLane,
}
