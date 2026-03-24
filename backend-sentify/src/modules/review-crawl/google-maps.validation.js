const { z } = require('zod')

const SUPPORTED_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'g.co', 'goo.gl'])

function preprocessOptionalTrimmedString(value) {
    if (typeof value !== 'string') {
        return value
    }

    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function isSupportedGoogleMapsUrl(value) {
    try {
        const parsed = new URL(value)
        const hostname = parsed.hostname.toLowerCase()

        if (hostname === 'google.com' || hostname === 'www.google.com' || hostname === 'maps.google.com') {
            return parsed.pathname.startsWith('/maps') || parsed.pathname.startsWith('/maps/')
        }

        if (SUPPORTED_SHORT_HOSTS.has(hostname)) {
            return true
        }

        return false
    } catch {
        return false
    }
}

const optionalTrimmedString = (schema) =>
    z.preprocess(preprocessOptionalTrimmedString, schema.optional())

function preprocessOptionalBoolean(value) {
    if (value === undefined || value === null || value === '') {
        return undefined
    }

    if (value === 'true') {
        return true
    }

    if (value === 'false') {
        return false
    }

    return value
}

const googleMapsUrlSchema = z
    .string()
    .trim()
    .url('url must be a valid URL')
    .refine(isSupportedGoogleMapsUrl, {
        message: 'url must be a supported Google Maps place URL',
    })

const crawlGoogleMapsOptionsSchema = z.object({
    url: googleMapsUrlSchema,
    language: z
        .string()
        .trim()
        .regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/, 'language must look like en or en-US')
        .default('en'),
    region: z
        .string()
        .trim()
        .regex(/^[a-zA-Z]{2}$/, 'region must be a 2-letter country code')
        .transform((value) => value.toLowerCase())
        .default('us'),
    sort: z.enum(['relevant', 'newest', 'highest_rating', 'lowest_rating']).default('newest'),
    searchQuery: optionalTrimmedString(z.string().max(120)),
    pages: z.union([z.literal('max'), z.coerce.number().int().positive().max(500)]).default(1),
    pageSize: z.coerce.number().int().min(1).max(20).default(20),
    maxReviews: z.coerce.number().int().positive().max(10000).optional(),
    delayMs: z.coerce.number().int().min(0).max(5000).default(0),
})

const crawlGoogleMapsRequestSchema = crawlGoogleMapsOptionsSchema.extend({
    restaurantId: z.string().trim().min(1, 'restaurantId is required'),
})

const upsertReviewCrawlSourceSchema = z.object({
    restaurantId: z.string().trim().min(1, 'restaurantId is required'),
    url: googleMapsUrlSchema,
    language: crawlGoogleMapsOptionsSchema.shape.language,
    region: crawlGoogleMapsOptionsSchema.shape.region,
    syncEnabled: z.preprocess(preprocessOptionalBoolean, z.boolean().optional()),
    syncIntervalMinutes: z.coerce.number().int().positive().max(7 * 24 * 60).optional(),
})

const createReviewCrawlRunSchema = z.object({
    strategy: z.enum(['INCREMENTAL', 'BACKFILL']).default('INCREMENTAL'),
    priority: z.enum(['HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
    maxPages: z.coerce.number().int().positive().max(500).optional(),
    maxReviews: z.coerce.number().int().positive().max(10000).optional(),
    pageSize: z.coerce.number().int().min(1).max(20).optional(),
    delayMs: z.coerce.number().int().min(0).max(5000).optional(),
})

module.exports = {
    createReviewCrawlRunSchema,
    crawlGoogleMapsOptionsSchema,
    crawlGoogleMapsRequestSchema,
    googleMapsUrlSchema,
    upsertReviewCrawlSourceSchema,
}
