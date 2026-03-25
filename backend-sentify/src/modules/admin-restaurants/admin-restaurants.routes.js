const express = require('express')

const { validateUuidParam } = require('../../middleware/validate-uuid')
const controller = require('./admin-restaurants.controller')

const router = express.Router()
const validateId = validateUuidParam('id')

router.get('/restaurants', controller.listAdminRestaurants)
router.get('/restaurants/:id', validateId, controller.getAdminRestaurantDetail)

module.exports = router
