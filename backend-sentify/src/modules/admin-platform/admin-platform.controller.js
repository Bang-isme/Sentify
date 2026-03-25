const { handleControllerError } = require('../../lib/controller-error')
const service = require('./admin-platform.service')
const { listAuditQuerySchema, updateControlsSchema } = require('./admin-platform.validation')

async function getHealthJobs(req, res) {
    try {
        const result = await service.getHealthJobs({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getIntegrationsPolicies(req, res) {
    try {
        const result = await service.getIntegrationsPolicies({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getAudit(req, res) {
    try {
        const query = listAuditQuerySchema.parse(req.query)
        const result = await service.getAuditFeed({
            userId: req.user.userId,
            limit: query.limit,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateControls(req, res) {
    try {
        const input = updateControlsSchema.parse(req.body)
        const result = await service.updateControls({
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

module.exports = {
    getAudit,
    getHealthJobs,
    getIntegrationsPolicies,
    updateControls,
}
