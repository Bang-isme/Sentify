const cors = require('cors')
const express = require('express')
const helmet = require('helmet')

const env = require('./config/env')
const authRoutes = require('./routes/auth')
const adminAccessRoutes = require('./modules/admin-access/admin-access.routes')
const adminRestaurantsRoutes = require('./modules/admin-restaurants/admin-restaurants.routes')
const adminIntakeRoutes = require('./modules/admin-intake/admin-intake.routes')
const adminPlatformRoutes = require('./modules/admin-platform/admin-platform.routes')
const reviewOpsRoutes = require('./modules/review-ops/review-ops.routes')
const reviewCrawlRoutes = require('./modules/review-crawl/google-maps.routes')
const { sendError } = require('./lib/controller-error')
const prisma = require('./lib/prisma')
const { getReviewCrawlQueueHealth } = require('./modules/review-crawl/review-crawl.queue')
const { csrfProtection } = require('./middleware/csrf')
const errorHandler = require('./middleware/error-handler')
const requireInternalRole = require('./middleware/require-internal-role')
const { apiLimiter } = require('./middleware/rate-limit')
const authMiddleware = require('./middleware/auth')
const requestIdMiddleware = require('./middleware/request-id')
const requestLogger = require('./middleware/request-logger')
const restaurantRoutes = require('./routes/restaurants')
const { INTERNAL_OPERATOR_ROLES } = require('./lib/user-roles')

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
        return res.status(200).json({ status: 'ok', db: 'skipped', redis: 'skipped' })
    }

    const [databaseProbe, queueHealthProbe] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        getReviewCrawlQueueHealth(),
    ])

    const dbStatus = databaseProbe.status === 'fulfilled' ? 'up' : 'down'

    let redisStatus = 'down'
    if (queueHealthProbe.status === 'fulfilled') {
        if (queueHealthProbe.value.inlineMode) {
            redisStatus = 'skipped'
        } else if (!queueHealthProbe.value.configured) {
            redisStatus = 'unconfigured'
        } else if (queueHealthProbe.value.errorMessage) {
            redisStatus = 'down'
        } else {
            redisStatus = 'up'
        }
    }

    const isHealthy = dbStatus === 'up' && (redisStatus === 'up' || redisStatus === 'skipped')

    return res
        .status(isHealthy ? 200 : 503)
        .json({ status: isHealthy ? 'ok' : 'unavailable', db: dbStatus, redis: redisStatus })
})

app.use('/api/auth', authRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/admin', authMiddleware, requireInternalRole(INTERNAL_OPERATOR_ROLES), adminAccessRoutes)
app.use('/api/admin', authMiddleware, requireInternalRole(INTERNAL_OPERATOR_ROLES), adminRestaurantsRoutes)
app.use('/api/admin', authMiddleware, requireInternalRole(INTERNAL_OPERATOR_ROLES), adminIntakeRoutes)
app.use('/api/admin', authMiddleware, requireInternalRole(INTERNAL_OPERATOR_ROLES), adminPlatformRoutes)
app.use('/api/admin', authMiddleware, requireInternalRole(INTERNAL_OPERATOR_ROLES), reviewCrawlRoutes)
app.use('/api/admin', authMiddleware, requireInternalRole(INTERNAL_OPERATOR_ROLES), reviewOpsRoutes)

app.use((req, res) => {
    return sendError(req, res, 404, 'NOT_FOUND', 'Resource not found')
})

app.use(errorHandler)

module.exports = app
