const { z } = require('zod')

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

const languageSchema = z
    .string()
    .trim()
    .regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/, 'language must look like en or en-US')
    .default('en')

const regionSchema = z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/, 'region must be a 2-letter country code')
    .transform((value) => value.toLowerCase())
    .default('us')

const resolveSourceSubmissionSchema = z.object({
    language: languageSchema,
    region: regionSchema,
})

const createSourceFromSubmissionSchema = z.object({
    language: languageSchema,
    region: regionSchema,
    syncEnabled: z.preprocess(preprocessOptionalBoolean, z.boolean().optional()),
    syncIntervalMinutes: z.coerce.number().int().positive().max(7 * 24 * 60).optional(),
})

const updateSourceSubmissionSchedulingLaneSchema = z.object({
    schedulingLane: z.enum(['STANDARD', 'PRIORITY']),
})

const updateRestaurantEntitlementSchema = z.object({
    planTier: z.enum(['FREE', 'PREMIUM']),
})

const claimNextSourceSubmissionSchema = z.object({
    leaseMinutes: z.coerce.number().int().positive().max(24 * 60).optional(),
})

module.exports = {
    claimNextSourceSubmissionSchema,
    createSourceFromSubmissionSchema,
    resolveSourceSubmissionSchema,
    updateRestaurantEntitlementSchema,
    updateSourceSubmissionSchedulingLaneSchema,
}
