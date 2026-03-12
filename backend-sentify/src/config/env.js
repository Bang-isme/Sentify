require('dotenv').config()

const path = require('path')
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

function optionalTrimmedString(schema) {
    return z.preprocess((value) => {
        if (typeof value !== 'string') {
            return value
        }

        const trimmed = value.trim()
        return trimmed === '' ? undefined : trimmed
    }, schema.optional())
}

function resolveBrowserProfile(userDataDir, explicitProfileDirectory) {
    const normalizedUserDataDir =
        typeof userDataDir === 'string' && userDataDir.trim() ? path.normalize(userDataDir) : null
    const normalizedExplicitProfileDirectory =
        typeof explicitProfileDirectory === 'string' && explicitProfileDirectory.trim()
            ? explicitProfileDirectory.trim()
            : null

    if (!normalizedUserDataDir) {
        return {
            userDataDirRoot: null,
            profileDirectory: normalizedExplicitProfileDirectory,
        }
    }

    if (normalizedExplicitProfileDirectory) {
        return {
            userDataDirRoot: normalizedUserDataDir,
            profileDirectory: normalizedExplicitProfileDirectory,
        }
    }

    const inferredProfileDirectory = path.basename(normalizedUserDataDir)

    if (
        /^(default|guest profile|system profile)$/i.test(inferredProfileDirectory) ||
        /^profile \d+$/i.test(inferredProfileDirectory)
    ) {
        return {
            userDataDirRoot: path.dirname(normalizedUserDataDir),
            profileDirectory: inferredProfileDirectory,
        }
    }

    return {
        userDataDirRoot: normalizedUserDataDir,
        profileDirectory: null,
    }
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
    REVIEW_BROWSER_HEADLESS: z.string().optional(),
    REVIEW_BROWSER_LANGUAGE_CODE: z.string().trim().min(2).default('en'),
    REVIEW_BROWSER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    REVIEW_BROWSER_PROFILE_BOOTSTRAP_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
    REVIEW_BROWSER_STATE_CACHE_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
    REVIEW_BROWSER_IDLE_CLOSE_MS: z.coerce.number().int().positive().default(60 * 1000),
    REVIEW_BROWSER_SCROLL_STEPS: z.coerce.number().int().positive().default(12),
    REVIEW_BROWSER_SCROLL_DELAY_MS: z.coerce.number().int().positive().default(750),
    REVIEW_BROWSER_MAX_REVIEWS: z.coerce.number().int().min(0).default(0),
    REVIEW_BROWSER_HARD_MAX_REVIEWS: z.coerce.number().int().positive().default(400),
    REVIEW_BROWSER_STALL_LIMIT: z.coerce.number().int().positive().default(5),
    REVIEW_BROWSER_HEAD_SYNC_TARGET: z.coerce.number().int().positive().default(24),
    REVIEW_BROWSER_RECENT_SYNC_TARGET: z.coerce.number().int().positive().default(60),
    REVIEW_BROWSER_DUPLICATE_STREAK_LIMIT: z.coerce.number().int().positive().default(12),
    REVIEW_BROWSER_MIN_REVIEWS_BEFORE_EARLY_STOP: z.coerce.number().int().positive().default(12),
    REVIEW_BROWSER_CHANNEL: optionalTrimmedString(z.string().min(2)),
    REVIEW_BROWSER_EXECUTABLE_PATH: optionalTrimmedString(z.string().min(1)),
    REVIEW_BROWSER_USER_DATA_DIR: optionalTrimmedString(z.string().min(1)),
    REVIEW_BROWSER_PROFILE_DIRECTORY: optionalTrimmedString(z.string().min(1)),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    IMPORT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    IMPORT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    IMPORT_RUN_HEARTBEAT_MS: z.coerce.number().int().positive().default(15 * 1000),
    IMPORT_RUN_STALE_MS: z.coerce.number().int().positive().default(90 * 1000),
    LOGIN_LOCK_THRESHOLD: z.coerce.number().int().positive().default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
})

const parsedEnv = envSchema.parse(process.env)
const browserProfile = resolveBrowserProfile(
    parsedEnv.REVIEW_BROWSER_USER_DATA_DIR,
    parsedEnv.REVIEW_BROWSER_PROFILE_DIRECTORY,
)

module.exports = {
    ...parsedEnv,
    AUTH_COOKIE_SECURE_VALUE: parseBoolean(
        parsedEnv.AUTH_COOKIE_SECURE,
        parsedEnv.NODE_ENV === 'production',
    ),
    REVIEW_BROWSER_HEADLESS_VALUE: parseBoolean(parsedEnv.REVIEW_BROWSER_HEADLESS, true),
    REVIEW_BROWSER_PROFILE_DIRECTORY_VALUE: browserProfile.profileDirectory,
    REVIEW_BROWSER_USER_DATA_DIR_ROOT: browserProfile.userDataDirRoot,
    TRUST_PROXY_VALUE: parseTrustProxy(parsedEnv.TRUST_PROXY),
    CORS_ORIGINS: parsedEnv.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
}
