const express = require('express')

const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth')
const { loginLimiter, registerLimiter } = require('../middleware/rate-limit')

const router = express.Router()

router.post('/register', registerLimiter, authController.register)
router.post('/login', loginLimiter, authController.login)
router.get('/session', authMiddleware, authController.getSession)
router.post('/logout', authMiddleware, authController.logout)

module.exports = router
