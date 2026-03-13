const { z } = require('zod')

function preprocessOptionalTrimmedString(value) {
    if (typeof value !== 'string') {
        return value
    }

    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function preprocessNullableTrimmedString(value) {
    if (value === null) {
        return null
    }

    if (typeof value !== 'string') {
        return value
    }

    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

function preprocessNullableDate(value) {
    if (value === null || value === undefined || value === '') {
        return value === undefined ? undefined : null
    }

    if (value instanceof Date) {
        return value
    }

    if (typeof value === 'string') {
        const parsedDate = new Date(value)
        return Number.isNaN(parsedDate.getTime()) ? value : parsedDate
    }

    return value
}

const optionalTrimmedString = (schema) =>
    z.preprocess(preprocessOptionalTrimmedString, schema.optional())

const nullableTrimmedString = (schema) =>
    z.preprocess(preprocessNullableTrimmedString, schema.nullable().optional())

const nullableDate = () =>
    z.preprocess(
        preprocessNullableDate,
        z.union([z.date(), z.null()]).optional(),
    )

const reviewItemInputSchema = z.object({
    rawAuthorName: optionalTrimmedString(z.string().max(120)),
    rawRating: z.number().int().min(1).max(5),
    rawContent: nullableTrimmedString(z.string().max(4000)),
    rawReviewDate: nullableDate(),
})

const createReviewBatchSchema = z.object({
    restaurantId: z.string().trim().min(1, 'restaurantId is required'),
    sourceType: z.enum(['MANUAL', 'BULK_PASTE', 'CSV']).default('MANUAL'),
    title: optionalTrimmedString(z.string().max(120)),
})

const listReviewBatchesQuerySchema = z.object({
    restaurantId: z.string().trim().min(1, 'restaurantId is required'),
})

const createReviewItemsSchema = z.object({
    items: z.array(reviewItemInputSchema).min(1, 'At least one review item is required').max(200),
})

const createReviewItemsBulkSchema = createReviewItemsSchema

const updateReviewItemSchema = z
    .object({
        normalizedAuthorName: nullableTrimmedString(z.string().max(120)),
        normalizedRating: z.union([z.number().int().min(1).max(5), z.null()]).optional(),
        normalizedContent: nullableTrimmedString(z.string().max(4000)),
        normalizedReviewDate: nullableDate(),
        approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        reviewerNote: nullableTrimmedString(z.string().max(500)),
    })
    .refine((payload) => Object.keys(payload).length > 0, {
        message: 'At least one field is required',
    })

module.exports = {
    createReviewBatchSchema,
    createReviewItemsSchema,
    createReviewItemsBulkSchema,
    listReviewBatchesQuerySchema,
    updateReviewItemSchema,
}
