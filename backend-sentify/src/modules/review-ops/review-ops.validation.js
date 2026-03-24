const { z } = require('zod')

const {
    googleMapsUrlSchema,
    crawlGoogleMapsOptionsSchema,
} = require('../review-crawl/google-maps.validation')

const syncToDraftSchema = z.object({
    restaurantId: z.string().trim().min(1, 'restaurantId is required'),
    url: googleMapsUrlSchema,
    language: crawlGoogleMapsOptionsSchema.shape.language.optional(),
    region: crawlGoogleMapsOptionsSchema.shape.region.optional(),
    strategy: z.enum(['INCREMENTAL', 'BACKFILL']).optional(),
    priority: z.enum(['HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
    maxPages: z.coerce.number().int().positive().max(500).optional(),
    maxReviews: z.coerce.number().int().positive().max(10000).optional(),
    pageSize: z.coerce.number().int().min(1).max(20).optional(),
    delayMs: z.coerce.number().int().min(0).max(5000).optional(),
})

const listSourcesQuerySchema = z.object({
    restaurantId: z.string().trim().min(1, 'restaurantId is required'),
})

const listSourceRunsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
})

const approveValidSchema = z.object({
    reviewerNote: z
        .string()
        .trim()
        .max(500, 'reviewerNote must be 500 characters or fewer')
        .optional(),
})

module.exports = {
    approveValidSchema,
    listSourceRunsQuerySchema,
    listSourcesQuerySchema,
    syncToDraftSchema,
}
