require('dotenv').config()

const cors = require('cors')
const express = require('express')

const authRoutes = require('./routes/auth')
const { sendError } = require('./lib/controller-error')
const requestIdMiddleware = require('./middleware/request-id')
const restaurantRoutes = require('./routes/restaurants')

const app = express()

app.use(requestIdMiddleware)
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    }),
)
app.use(express.json())

app.get('/', (req, res) => {
    return res.status(200).json({
        service: 'backend-sentify',
        status: 'ok',
    })
})

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok' })
})

app.get('/api/health', (req, res) => {
    return res.status(200).json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/restaurants', restaurantRoutes)

app.use((req, res) => {
    return sendError(req, res, 404, 'NOT_FOUND', 'Resource not found')
})

module.exports = app
