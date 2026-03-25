const express = require('express')

const dashboardController = require('../controllers/dashboard.controller')
const reviewsController = require('../controllers/reviews.controller')
const restaurantController = require('../controllers/restaurants.controller')
const authMiddleware = require('../middleware/auth')
const requireUserRole = require('../middleware/require-user-role')
const { validateUuidParam } = require('../middleware/validate-uuid')
const { USER_ROLE } = require('../lib/user-roles')

const router = express.Router()

const validateId = validateUuidParam('id')

router.use(authMiddleware)
router.use(requireUserRole(USER_ROLE.USER))

router.post('/', restaurantController.createRestaurant)
router.get('/', restaurantController.listRestaurants)
router.get('/:id/reviews', validateId, reviewsController.listReviews)
router.get('/:id/dashboard/kpi', validateId, dashboardController.getKpi)
router.get('/:id/dashboard/sentiment', validateId, dashboardController.getSentimentBreakdown)
router.get('/:id/dashboard/trend', validateId, dashboardController.getTrend)
router.get('/:id/dashboard/complaints', validateId, dashboardController.getComplaintKeywords)
router.get('/:id/dashboard/top-issue', validateId, dashboardController.getTopIssue)
router.get('/:id', validateId, restaurantController.getRestaurantDetail)
router.patch('/:id', validateId, restaurantController.updateRestaurant)

module.exports = router
