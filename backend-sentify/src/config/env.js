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
    JWT_ISSUER: z.string().min(1).default('sentify-api'),
    JWT_AUDIENCE: z.string().min(1).default('sentify-web'),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    BODY_LIMIT: z.string().min(1).default('100kb'),
    AUTH_COOKIE_NAME: z.string().min(1).default('sentify_access_token'),
    AUTH_COOKIE_DOMAIN: z.string().trim().optional(),
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    AUTH_COOKIE_SECURE: z.string().optional(),
    TRUST_PROXY: z.string().optional(),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    IMPORT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    IMPORT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    LOGIN_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
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
