const crypto = require('node:crypto')

const { badRequest, conflict, notFound } = require('../../lib/app-error')
const { analyzeReviewSync } = require('../../services/sentiment-analyzer.service')

function summarizeBatchItems(items) {
    return items.reduce(
        (summary, item) => {
            summary.totalItems += 1

            if (item.approvalStatus === 'APPROVED') {
                summary.approvedItems += 1
            } else if (item.approvalStatus === 'REJECTED') {
                summary.rejectedItems += 1
            } else {
                summary.pendingItems += 1
            }

            if (item.canonicalReviewId) {
                summary.publishedItems += 1
            }

            return summary
        },
        {
            totalItems: 0,
            pendingItems: 0,
            approvedItems: 0,
            rejectedItems: 0,
            publishedItems: 0,
        },
    )
}

function deriveBatchStatus(batch, items) {
    if (!items.length) {
        return 'DRAFT'
    }

    if (batch.status === 'PUBLISHED') {
        return 'PUBLISHED'
    }

    const summary = summarizeBatchItems(items)

    if (summary.approvedItems > 0 && summary.pendingItems === 0) {
        return 'READY_TO_PUBLISH'
    }

    if (summary.approvedItems > 0 || summary.rejectedItems > 0) {
        return 'IN_REVIEW'
    }

    return 'DRAFT'
}

function resolveEditableBatch(batch) {
    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    if (batch.status === 'PUBLISHED' || batch.status === 'ARCHIVED') {
        throw conflict(
            'INTAKE_BATCH_LOCKED',
            'This review batch is already published or archived',
        )
    }
}

function resolveDeletableBatch(batch) {
    if (!batch) {
        throw notFound('NOT_FOUND', 'Review batch not found')
    }

    if (!['DRAFT', 'IN_REVIEW'].includes(batch.status)) {
        throw conflict(
            'INTAKE_BATCH_NOT_DELETABLE',
            'Only draft or in-review batches can be deleted',
        )
    }
}

function stripHtmlTags(value) {
    if (typeof value !== 'string') {
        return value
    }

    return value.replace(/<[^>]*>/g, '')
}

function sanitizeNullableText(value) {
    if (value === undefined || value === null) {
        return null
    }

    if (typeof value !== 'string') {
        return value
    }

    const sanitized = stripHtmlTags(value).replace(/\s+/g, ' ').trim()
    return sanitized === '' ? null : sanitized
}

function resolvePublishedField(preferredValue, fallbackValue = null) {
    if (preferredValue === undefined || preferredValue === null) {
        return fallbackValue
    }

    return preferredValue
}

function normalizeIncomingItem(item) {
    const sourceProvider = item.sourceProvider ?? null
    const sourceExternalId = sanitizeNullableText(item.sourceExternalId)
    const sourceReviewUrl = sanitizeNullableText(item.sourceReviewUrl)
    const rawAuthorName = sanitizeNullableText(item.rawAuthorName)
    const rawContent = sanitizeNullableText(item.rawContent)
    const rawReviewDate = item.rawReviewDate ?? null

    return {
        sourceProvider,
        sourceExternalId,
        sourceReviewUrl,
        rawAuthorName,
        rawRating: item.rawRating,
        rawContent,
        rawReviewDate,
        normalizedAuthorName: rawAuthorName,
        normalizedRating: item.rawRating,
        normalizedContent: rawContent,
        normalizedReviewDate: rawReviewDate,
    }
}

function buildSourceIdentity(item) {
    return {
        authorName: sanitizeNullableText(
            resolvePublishedField(item.rawAuthorName, item.normalizedAuthorName),
        ),
        rating: resolvePublishedField(item.rawRating, item.normalizedRating),
        content: sanitizeNullableText(
            resolvePublishedField(item.rawContent, item.normalizedContent),
        ),
        reviewDate: resolvePublishedField(item.rawReviewDate, item.normalizedReviewDate),
    }
}

function buildPublishedIdentity(item) {
    return {
        authorName: sanitizeNullableText(
            resolvePublishedField(item.normalizedAuthorName, item.rawAuthorName),
        ),
        rating: resolvePublishedField(item.normalizedRating, item.rawRating),
        content: sanitizeNullableText(
            resolvePublishedField(item.normalizedContent, item.rawContent),
        ),
        reviewDate: resolvePublishedField(item.normalizedReviewDate, item.rawReviewDate),
    }
}

function serializeIdentity(identity) {
    const reviewDate =
        identity.reviewDate instanceof Date ? identity.reviewDate.toISOString() : ''

    return [
        identity.authorName ?? '',
        identity.rating ?? '',
        identity.content ?? '',
        reviewDate,
    ].join('|')
}

function buildRawItemKey(item) {
    return serializeIdentity(buildSourceIdentity(item))
}

function buildCanonicalReviewExternalId(restaurantId, item) {
    if (item.sourceProvider && item.sourceExternalId) {
        return `source-review:v1:${item.sourceProvider.toLowerCase()}:${item.sourceExternalId}`
    }

    const fingerprint = crypto
        .createHash('sha256')
        .update(`${restaurantId}|${serializeIdentity(buildSourceIdentity(item))}`)
        .digest('hex')
        .slice(0, 40)

    return `manual-intake:v1:${fingerprint}`
}

function assertPublishableIdentity(identity) {
    if (!Number.isInteger(identity.rating) || identity.rating < 1 || identity.rating > 5) {
        throw badRequest(
            'INTAKE_REVIEW_INVALID_RATING',
            'Each approved review item must have a rating between 1 and 5',
        )
    }

    if (identity.reviewDate && identity.reviewDate > new Date()) {
        throw badRequest(
            'INTAKE_REVIEW_INVALID_DATE',
            'Approved review items cannot have a review date in the future',
        )
    }

    if (!identity.authorName && !identity.content && !identity.reviewDate) {
        throw badRequest(
            'INTAKE_REVIEW_INSUFFICIENT_EVIDENCE',
            'Each approved review item must include author name, content, or review date',
        )
    }
}

function buildReviewPayload(restaurantId, item) {
    const published = buildPublishedIdentity(item)
    assertPublishableIdentity(published)

    const analysis = analyzeReviewSync({
        content: published.content,
        rating: published.rating,
    })

    return {
        restaurantId,
        externalId: buildCanonicalReviewExternalId(restaurantId, item),
        authorName: published.authorName,
        rating: published.rating,
        content: published.content,
        sentiment: analysis.label,
        keywords: analysis.keywords,
        reviewDate: published.reviewDate,
    }
}

function pickDefined(input, fieldMap) {
    return Object.entries(fieldMap).reduce((accumulator, [field, mapper]) => {
        if (Object.prototype.hasOwnProperty.call(input, field)) {
            const value = input[field]
            accumulator[field] = typeof mapper === 'function' ? mapper(value, input) : value
        }

        return accumulator
    }, {})
}

function mapBatch(batch, options = {}) {
    const items = Array.isArray(batch.items) ? batch.items : []
    const counts = summarizeBatchItems(items)

    return {
        id: batch.id,
        restaurantId: batch.restaurantId,
        createdByUserId: batch.createdByUserId,
        title: batch.title ?? null,
        sourceType: batch.sourceType,
        status: batch.status,
        publishedAt: batch.publishedAt,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        counts,
        ...(options.includeItems
            ? {
                  items: items.map((item) => ({
                      id: item.id,
                      batchId: item.batchId,
                      restaurantId: item.restaurantId,
                      sourceProvider: item.sourceProvider ?? null,
                      sourceExternalId: item.sourceExternalId ?? null,
                      sourceReviewUrl: item.sourceReviewUrl ?? null,
                      rawAuthorName: item.rawAuthorName ?? null,
                      rawRating: item.rawRating ?? null,
                      rawContent: item.rawContent ?? null,
                      rawReviewDate: item.rawReviewDate ?? null,
                      normalizedAuthorName: item.normalizedAuthorName ?? null,
                      normalizedRating: item.normalizedRating ?? null,
                      normalizedContent: item.normalizedContent ?? null,
                      normalizedReviewDate: item.normalizedReviewDate ?? null,
                      approvalStatus: item.approvalStatus,
                      reviewerNote: item.reviewerNote ?? null,
                      canonicalReviewId: item.canonicalReviewId ?? null,
                      createdAt: item.createdAt,
                      updatedAt: item.updatedAt,
                  })),
              }
            : {}),
    }
}

module.exports = {
    buildCanonicalReviewExternalId,
    buildRawItemKey,
    buildReviewPayload,
    deriveBatchStatus,
    mapBatch,
    normalizeIncomingItem,
    pickDefined,
    resolveDeletableBatch,
    resolveEditableBatch,
    summarizeBatchItems,
}
