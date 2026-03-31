const { badRequest } = require('../../lib/app-error')
const { appendAuditEvent } = require('../../services/audit-event.service')
const {
    getEffectiveRestaurantEntitlement,
} = require('../../services/restaurant-entitlement.service')
const {
    computeNextScheduledAt,
    mapSource,
} = require('./review-crawl.domain')
const repository = require('./review-crawl.repository')

const SOURCE_MUTATION_AUDIT_FIELDS = [
    'inputUrl',
    'resolvedUrl',
    'canonicalCid',
    'placeHexId',
    'googlePlaceId',
    'placeName',
    'language',
    'region',
    'syncEnabled',
    'syncIntervalMinutes',
    'status',
]

function resolveSourceCreateInput(input, resolved, now, defaults = {}) {
    const syncIntervalMinutes =
        input.syncIntervalMinutes ??
        defaults.syncIntervalMinutes ??
        1440
    const syncEnabled = input.syncEnabled ?? true

    return {
        create: {
            status: 'ACTIVE',
            inputUrl: input.url,
            resolvedUrl: resolved.source.resolvedUrl ?? null,
            placeHexId: resolved.place.identifiers.placeHexId ?? null,
            googlePlaceId: resolved.place.identifiers.googlePlaceId ?? null,
            placeName: resolved.place.name ?? null,
            language: input.language,
            region: input.region,
            syncEnabled,
            syncIntervalMinutes,
            lastReportedTotal: resolved.place.totalReviewCount ?? null,
            nextScheduledAt: syncEnabled
                ? computeNextScheduledAt(now, syncIntervalMinutes)
                : null,
        },
        update: {
            inputUrl: input.url,
            resolvedUrl: resolved.source.resolvedUrl ?? null,
            placeHexId: resolved.place.identifiers.placeHexId ?? null,
            googlePlaceId: resolved.place.identifiers.googlePlaceId ?? null,
            placeName: resolved.place.name ?? null,
            language: input.language,
            region: input.region,
            lastReportedTotal: resolved.place.totalReviewCount ?? null,
            ...(Object.prototype.hasOwnProperty.call(input, 'syncEnabled')
                ? {
                      syncEnabled,
                      nextScheduledAt: syncEnabled
                          ? computeNextScheduledAt(now, syncIntervalMinutes)
                          : null,
                  }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(input, 'syncIntervalMinutes')
                ? {
                      syncIntervalMinutes,
                      nextScheduledAt: syncEnabled
                          ? computeNextScheduledAt(now, syncIntervalMinutes)
                          : null,
                  }
                : {}),
        },
    }
}

function getCanonicalCidFromResolvedPlace(resolved) {
    return resolved?.place?.identifiers?.cid ?? null
}

function buildSourceAuditSnapshot(source) {
    if (!source) {
        return null
    }

    return {
        inputUrl: source.inputUrl ?? null,
        resolvedUrl: source.resolvedUrl ?? null,
        canonicalCid: source.canonicalCid ?? null,
        placeHexId: source.placeHexId ?? null,
        googlePlaceId: source.googlePlaceId ?? null,
        placeName: source.placeName ?? null,
        language: source.language ?? null,
        region: source.region ?? null,
        syncEnabled: source.syncEnabled ?? null,
        syncIntervalMinutes: source.syncIntervalMinutes ?? null,
        status: source.status ?? null,
    }
}

function listChangedSourceFields(previousSource, nextSource) {
    const previousSnapshot = buildSourceAuditSnapshot(previousSource) ?? {}
    const nextSnapshot = buildSourceAuditSnapshot(nextSource) ?? {}

    return SOURCE_MUTATION_AUDIT_FIELDS.filter(
        (field) => previousSnapshot[field] !== nextSnapshot[field],
    )
}

function determineSourceMutationAction(previousSource, nextSource, changedFields) {
    if (!previousSource) {
        return 'CRAWL_SOURCE_CREATED'
    }

    if (changedFields.includes('status')) {
        return nextSource.status === 'DISABLED'
            ? 'CRAWL_SOURCE_DISABLED'
            : 'CRAWL_SOURCE_ENABLED'
    }

    if (changedFields.includes('syncEnabled')) {
        return nextSource.syncEnabled
            ? 'CRAWL_SOURCE_SYNC_ENABLED'
            : 'CRAWL_SOURCE_SYNC_DISABLED'
    }

    return 'CRAWL_SOURCE_RECONFIGURED'
}

function buildSourceMutationSummary(action, source) {
    const sourceLabel = source.placeName || source.canonicalCid || source.id

    switch (action) {
        case 'CRAWL_SOURCE_CREATED':
            return `Crawl source ${sourceLabel} was created.`
        case 'CRAWL_SOURCE_DISABLED':
            return `Crawl source ${sourceLabel} was disabled.`
        case 'CRAWL_SOURCE_ENABLED':
            return `Crawl source ${sourceLabel} was enabled.`
        case 'CRAWL_SOURCE_SYNC_DISABLED':
            return `Automatic sync was disabled for crawl source ${sourceLabel}.`
        case 'CRAWL_SOURCE_SYNC_ENABLED':
            return `Automatic sync was enabled for crawl source ${sourceLabel}.`
        case 'CRAWL_SOURCE_RECONFIGURED':
        default:
            return `Crawl source ${sourceLabel} was reconfigured.`
    }
}

async function persistResolvedReviewCrawlSource({ userId, input, resolved }) {
    const canonicalCid = getCanonicalCidFromResolvedPlace(resolved)

    if (!canonicalCid) {
        throw badRequest(
            'REVIEW_CRAWL_SOURCE_IDENTITY_UNAVAILABLE',
            'Could not resolve a canonical crawl identity from the Google Maps URL',
        )
    }

    const now = new Date()
    const effectiveEntitlement = await getEffectiveRestaurantEntitlement(
        input.restaurantId,
    )
    const nextSourceState = resolveSourceCreateInput(input, resolved, now, {
        syncIntervalMinutes:
            effectiveEntitlement.effectivePolicy.sourceSyncIntervalMinutes,
    })
    const sourceIdentity = {
        restaurantId: input.restaurantId,
        provider: 'GOOGLE_MAPS',
        canonicalCid,
    }
    const existingSource = await repository.findSourceByCanonicalIdentity(
        sourceIdentity,
    )
    const source = await repository.upsertSourceByCanonicalIdentity(
        sourceIdentity,
        nextSourceState.create,
        nextSourceState.update,
    )
    const changedFields = listChangedSourceFields(existingSource, source)

    if (!existingSource || changedFields.length > 0) {
        const action = determineSourceMutationAction(
            existingSource,
            source,
            changedFields,
        )

        await appendAuditEvent({
            action,
            resourceType: 'crawlSource',
            resourceId: source.id,
            restaurantId: source.restaurantId,
            actorUserId: userId,
            summary: buildSourceMutationSummary(action, source),
            metadata: {
                provider: source.provider,
                canonicalCid: source.canonicalCid,
                changedFields,
                previous: buildSourceAuditSnapshot(existingSource),
                current: buildSourceAuditSnapshot(source),
            },
        })
    }

    return {
        source: mapSource(source),
        metadata: {
            placeName: resolved.place?.name ?? null,
            totalReviewCount: resolved.place?.totalReviewCount ?? null,
            googlePlaceId: resolved.place?.identifiers?.googlePlaceId ?? null,
            placeHexId: resolved.place?.identifiers?.placeHexId ?? null,
        },
    }
}

module.exports = {
    persistResolvedReviewCrawlSource,
}
