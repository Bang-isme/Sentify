const cors = require('cors')
const express = require('express')
const helmet = require('helmet')

const env = require('./config/env')
const authRoutes = require('./routes/auth')
const adminIntakeRoutes = require('./modules/admin-intake/admin-intake.routes')
const reviewOpsRoutes = require('./modules/review-ops/review-ops.routes')
const reviewCrawlRoutes = require('./modules/review-crawl/google-maps.routes')
const { sendError } = require('./lib/controller-error')
const prisma = require('./lib/prisma')
const { csrfProtection } = require('./middleware/csrf')
const errorHandler = require('./middleware/error-handler')
const { apiLimiter } = require('./middleware/rate-limit')
const authMiddleware = require('./middleware/auth')
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
        // Keep methods intentionally narrow for MVP. Add DELETE only when an endpoint requires it.
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token'],
    }),
)
app.use(helmet())
app.use(express.json({ limit: env.BODY_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: env.BODY_LIMIT }))
app.use('/api', apiLimiter)
app.use(csrfProtection)

app.get('/', (req, res) => {
    return res.status(200).json({
        service: 'backend-sentify',
        status: 'ok',
    })
})

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok' })
})

app.get('/api/health', async (req, res) => {
    if (env.NODE_ENV === 'test') {
        return res.status(200).json({ status: 'ok', db: 'skipped' })
    }

    try {
        await prisma.$queryRaw`SELECT 1`
        return res.status(200).json({ status: 'ok', db: 'up' })
    } catch (error) {
        return res.status(503).json({ status: 'unavailable', db: 'down' })
    }
})

app.use('/api/auth', authRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/admin', authMiddleware, adminIntakeRoutes)
app.use('/api/admin', authMiddleware, reviewCrawlRoutes)
app.use('/api/admin', authMiddleware, reviewOpsRoutes)

app.use((req, res) => {
    return sendError(req, res, 404, 'NOT_FOUND', 'Resource not found')
})

app.use(errorHandler)

module.exports = app
