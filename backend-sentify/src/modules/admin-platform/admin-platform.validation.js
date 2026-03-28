const { z } = require('zod')

const listAuditQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(25),
})

const updateControlsSchema = z
    .object({
        crawlQueueWritesEnabled: z.boolean().optional(),
        crawlMaterializationEnabled: z.boolean().optional(),
        intakePublishEnabled: z.boolean().optional(),
        sourceSubmissionAutoBootstrapEnabled: z.boolean().optional(),
        sourceSubmissionAutoBootstrapMaxPerTick: z.coerce
            .number()
            .int()
            .positive()
            .max(100)
            .optional(),
        note: z
            .string()
            .trim()
            .max(240)
            .optional()
            .transform((value) => (value && value.length > 0 ? value : null)),
    })
    .refine(
        (value) =>
            Object.prototype.hasOwnProperty.call(value, 'crawlQueueWritesEnabled') ||
            Object.prototype.hasOwnProperty.call(value, 'crawlMaterializationEnabled') ||
            Object.prototype.hasOwnProperty.call(value, 'intakePublishEnabled') ||
            Object.prototype.hasOwnProperty.call(
                value,
                'sourceSubmissionAutoBootstrapEnabled',
            ) ||
            Object.prototype.hasOwnProperty.call(
                value,
                'sourceSubmissionAutoBootstrapMaxPerTick',
            ) ||
            Object.prototype.hasOwnProperty.call(value, 'note'),
        {
            message: 'At least one control field must be provided',
        },
    )

module.exports = {
    listAuditQuerySchema,
    updateControlsSchema,
}
