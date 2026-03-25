const express = require('express')

const controller = require('./admin-platform.controller')

const router = express.Router()

router.get('/platform/health-jobs', controller.getHealthJobs)
router.get('/platform/integrations-policies', controller.getIntegrationsPolicies)
router.get('/platform/audit', controller.getAudit)
router.patch('/platform/controls', controller.updateControls)

module.exports = router
