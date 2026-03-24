const express = require('express')

const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth')
const { loginLimiter, passwordChangeLimiter, registerLimiter } = require('../middleware/rate-limit')

const router = express.Router()

router.get('/csrf', authController.issueCsrfToken)
router.post('/register', registerLimiter, authController.register)
router.post('/login', loginLimiter, authController.login)
router.get('/session', authMiddleware, authController.getSession)
router.post('/logout', authMiddleware, authController.logout)
router.patch('/password', authMiddleware, passwordChangeLimiter, authController.changePassword)
router.post('/refresh', loginLimiter, authController.refresh)
router.post('/forgot-password', loginLimiter, authController.forgotPassword)
router.post('/reset-password', loginLimiter, authController.resetPassword)

module.exports = router
