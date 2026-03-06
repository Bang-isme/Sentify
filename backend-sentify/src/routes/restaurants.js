const express = require('express')

const dashboardController = require('../controllers/dashboard.controller')
const importController = require('../controllers/import.controller')
const reviewsController = require('../controllers/reviews.controller')
const restaurantController = require('../controllers/restaurants.controller')
const authMiddleware = require('../middleware/auth')

const router = express.Router()

router.use(authMiddleware)

router.post('/', restaurantController.createRestaurant)
router.get('/', restaurantController.listRestaurants)
router.post('/:id/import', importController.importReviews)
router.get('/:id/reviews', reviewsController.listReviews)
router.get('/:id/dashboard/kpi', dashboardController.getKpi)
router.get('/:id/dashboard/sentiment', dashboardController.getSentimentBreakdown)
router.get('/:id/dashboard/trend', dashboardController.getTrend)
router.get('/:id/dashboard/complaints', dashboardController.getComplaintKeywords)
router.get('/:id', restaurantController.getRestaurantDetail)
router.patch('/:id', restaurantController.updateRestaurant)

module.exports = router
