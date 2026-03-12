const cors = require('cors')
const express = require('express')
const helmet = require('helmet')

const env = require('./config/env')
const authRoutes = require('./routes/auth')
const { sendError } = require('./lib/controller-error')
const errorHandler = require('./middleware/error-handler')
const { apiLimiter } = require('./middleware/rate-limit')
const requestIdMiddleware = require('./middleware/request-id')
const requestLogger = require('./middleware/request-logger')
const restaurantRoutes = require('./routes/restaurants')

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', env.TRUST_PROXY_VALUE)
app.use(requestIdMiddleware)
app.use(requestLogger)
app.use(
    cors({
        origin: env.CORS_ORIGINS,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH'],
        allowedHeaders: ['Authorization', 'Content-Type'],
    }),
)
app.use(helmet())
app.use(express.json({ limit: env.BODY_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: env.BODY_LIMIT }))
app.use('/api', apiLimiter)

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

app.use(errorHandler)

module.exports = app
