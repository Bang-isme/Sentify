require('dotenv').config()

const { z } = require('zod')

function parseTrustProxy(value) {
    if (value === undefined || value === null || value === '') {
        return false
    }

    if (value === 'true') {
        return true
    }

    if (value === 'false') {
        return false
    }

    const numericValue = Number(value)
    return Number.isNaN(numericValue) ? value : numericValue
}

function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }

    if (value === 'true') {
        return true
    }

    if (value === 'false') {
        return false
    }

    return fallback
}

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_FORMAT: z.enum(['auto', 'json', 'pretty']).default('auto'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_SECRET_PREVIOUS: z.string().min(32).optional(),
    JWT_ISSUER: z.string().min(1).default('sentify-api'),
    JWT_AUDIENCE: z.string().min(1).default('sentify-web'),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    BODY_LIMIT: z.string().min(1).default('100kb'),
    AUTH_COOKIE_NAME: z.string().min(1).default('sentify_access_token'),
    AUTH_COOKIE_DOMAIN: z.string().trim().optional(),
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    AUTH_COOKIE_SECURE: z.string().optional(),
    TRUST_PROXY: z.string().optional(),
    // Prisma adapter currently only honors connection_limit (max); minimum pool size is not configurable.
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    LOGIN_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
    APP_URL: z.string().min(1).default('http://localhost:5173'),
    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REVIEW_CRAWL_QUEUE_NAME: z.string().min(1).default('review-crawl'),
    REVIEW_CRAWL_WORKER_CONCURRENCY: z.coerce.number().int().positive().max(20).default(2),
    REVIEW_CRAWL_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
    REVIEW_CRAWL_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
    REVIEW_CRAWL_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(5 * 1000),
    REVIEW_CRAWL_LEASE_SECONDS: z.coerce.number().int().positive().default(90),
    REVIEW_CRAWL_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(20 * 1000),
    REVIEW_CRAWL_INCREMENTAL_MAX_PAGES: z.coerce.number().int().positive().default(10),
    REVIEW_CRAWL_BACKFILL_MAX_PAGES: z.coerce.number().int().positive().default(250),
    REVIEW_CRAWL_MAX_DURATION_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
    REVIEW_CRAWL_KNOWN_REVIEW_STREAK_LIMIT: z.coerce.number().int().positive().default(25),
    REVIEW_CRAWL_FAILURE_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(30),
    REVIEW_CRAWL_SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(60 * 1000),
    REVIEW_CRAWL_SCHEDULER_BATCH_SIZE: z.coerce.number().int().positive().default(20),
})

const parsedEnv = envSchema.parse(process.env)

module.exports = {
    ...parsedEnv,
    AUTH_COOKIE_SECURE_VALUE: parseBoolean(
        parsedEnv.AUTH_COOKIE_SECURE,
        parsedEnv.NODE_ENV === 'production',
    ),
    TRUST_PROXY_VALUE: parseTrustProxy(parsedEnv.TRUST_PROXY),
    CORS_ORIGINS: parsedEnv.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
}
