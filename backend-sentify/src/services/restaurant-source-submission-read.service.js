const prisma = require('../lib/prisma')
const {
    SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
    buildInitialSourceSubmission,
    buildSourceSubmissionFromState,
    buildSourceSubmissionHistory,
    buildSourceSubmissionTimeline,
} = require('./restaurant-source-submission-view.service')

async function fetchPersistedSourceSubmissionRecord(restaurantId) {
    return prisma.restaurantSourceSubmission.findUnique({
        where: {
            restaurantId,
        },
        select: {
            id: true,
            restaurantId: true,
            provider: true,
            status: true,
            inputUrl: true,
            normalizedUrl: true,
            canonicalCid: true,
            placeName: true,
            googlePlaceId: true,
            placeHexId: true,
            dedupeKey: true,
            schedulingLane: true,
            schedulingLaneSource: true,
            recommendationCode: true,
            recommendationMessage: true,
            linkedSourceId: true,
            submittedAt: true,
            lastResolvedAt: true,
        },
    })
}

async function fetchSourceSubmissionState(restaurantId, googleMapUrl, sourceSubmissionRecord = null) {
    if (!googleMapUrl) {
        return {
            source: null,
            latestRun: null,
            openBatch: null,
            publishedBatch: null,
        }
    }

    const sourceSelect = {
        id: true,
        provider: true,
        status: true,
        inputUrl: true,
        canonicalCid: true,
        placeName: true,
        syncEnabled: true,
        lastSyncedAt: true,
        lastSuccessfulRunAt: true,
        createdAt: true,
        updatedAt: true,
    }

    let source = null

    if (sourceSubmissionRecord?.linkedSourceId) {
        source = await prisma.reviewCrawlSource.findUnique({
            where: {
                id: sourceSubmissionRecord.linkedSourceId,
            },
            select: sourceSelect,
        })
    }

    if (!source && sourceSubmissionRecord?.canonicalCid) {
        source = await prisma.reviewCrawlSource.findUnique({
            where: {
                restaurantId_provider_canonicalCid: {
                    restaurantId,
                    provider: 'GOOGLE_MAPS',
                    canonicalCid: sourceSubmissionRecord.canonicalCid,
                },
            },
            select: sourceSelect,
        })
    }

    if (!source) {
        source = await prisma.reviewCrawlSource.findFirst({
            where: {
                restaurantId,
                inputUrl: googleMapUrl,
            },
            select: sourceSelect,
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        })
    }

    if (!source) {
        return {
            source: null,
            latestRun: null,
            openBatch: null,
            publishedBatch: null,
        }
    }

    const [latestRun, sourceOpenBatch, sourcePublishedBatch] = await Promise.all([
        prisma.reviewCrawlRun.findFirst({
            where: {
                sourceId: source.id,
            },
            select: {
                id: true,
                status: true,
                requestedByUserId: true,
                intakeBatchId: true,
                queuedAt: true,
                startedAt: true,
                finishedAt: true,
                validCount: true,
                warningCount: true,
                errorCode: true,
                errorMessage: true,
            },
            orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.reviewIntakeBatch.findFirst({
            where: {
                crawlSourceId: source.id,
                status: {
                    in: ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'],
                },
            },
            select: {
                id: true,
                status: true,
                title: true,
                updatedAt: true,
                createdAt: true,
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.reviewIntakeBatch.findFirst({
            where: {
                crawlSourceId: source.id,
                status: 'PUBLISHED',
            },
            select: {
                id: true,
                status: true,
                title: true,
                publishedAt: true,
            },
            orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        }),
    ])

    const linkedBatch = latestRun?.intakeBatchId
        ? await prisma.reviewIntakeBatch.findUnique({
              where: {
                  id: latestRun.intakeBatchId,
              },
              select: {
                  id: true,
                  status: true,
                  title: true,
                  updatedAt: true,
                  createdAt: true,
                  publishedAt: true,
              },
          })
        : null

    const openBatch =
        linkedBatch && ['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'].includes(linkedBatch.status)
            ? linkedBatch
            : sourceOpenBatch

    const publishedBatch =
        linkedBatch?.status === 'PUBLISHED' ? linkedBatch : sourcePublishedBatch

    return {
        source,
        latestRun,
        openBatch,
        publishedBatch,
    }
}

async function fetchSourceSubmissionAuditEvents({
    restaurantId,
    restaurantGoogleMapUrl,
    submissionRecord = null,
}) {
    if (!restaurantGoogleMapUrl && !submissionRecord) {
        return []
    }

    const auditEvents = await prisma.auditEvent.findMany({
        where: {
            restaurantId,
            action: {
                in: [
                    'MERCHANT_SOURCE_SUBMITTED',
                    'MERCHANT_SOURCE_UPDATED',
                    'ADMIN_SOURCE_SUBMISSION_RESOLVED',
                    'ADMIN_SOURCE_SUBMISSION_LINKED',
                    'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED',
                    'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR',
                    'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
                ],
            },
            ...(submissionRecord?.submittedAt
                ? {
                      createdAt: {
                          gte: submissionRecord.submittedAt,
                      },
                  }
                : {}),
        },
        orderBy: {
            createdAt: 'asc',
        },
        include: {
            actor: {
                select: {
                    id: true,
                    role: true,
                },
            },
        },
    })

    return auditEvents.filter((event) => {
        if (event.action.startsWith('MERCHANT_SOURCE_')) {
            return event.resourceId === restaurantId
        }

        if (
            event.action.startsWith('ADMIN_SOURCE_SUBMISSION_') ||
            event.action.startsWith('SCHEDULER_SOURCE_SUBMISSION_')
        ) {
            return submissionRecord ? event.resourceId === submissionRecord.id : true
        }

        return true
    })
}

async function fetchRestaurantSourceSubmissionHistoryAuditEvents(restaurantId) {
    return prisma.auditEvent.findMany({
        where: {
            restaurantId,
            action: {
                in: SOURCE_SUBMISSION_HISTORY_AUDIT_ACTIONS,
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            actor: {
                select: {
                    id: true,
                    role: true,
                },
            },
        },
    })
}

async function buildCurrentSourceSubmission(restaurantId, googleMapUrl, latestPublishedBatch = null) {
    if (!googleMapUrl) {
        const sourceSubmission = buildInitialSourceSubmission(null)
        const history = buildSourceSubmissionHistory({
            googleMapUrl,
            sourceSubmission,
        })

        return {
            ...sourceSubmission,
            timeline: buildSourceSubmissionTimeline({
                sourceSubmission,
                history,
            }),
        }
    }

    const submissionRecord = await fetchPersistedSourceSubmissionRecord(restaurantId)
    const sourceState = await fetchSourceSubmissionState(
        restaurantId,
        googleMapUrl,
        submissionRecord,
    )
    const sourceSubmission = buildSourceSubmissionFromState({
        googleMapUrl,
        latestPublishedBatch,
        sourceSubmissionRecord: submissionRecord,
        ...sourceState,
    })
    const auditEvents = await fetchSourceSubmissionAuditEvents({
        restaurantId,
        restaurantGoogleMapUrl: googleMapUrl,
        submissionRecord,
    })
    const history = buildSourceSubmissionHistory({
        googleMapUrl,
        sourceSubmission,
        submissionRecord,
        auditEvents,
        latestPublishedBatch,
        ...sourceState,
    })

    return {
        ...sourceSubmission,
        timeline: buildSourceSubmissionTimeline({
            sourceSubmission,
            submissionRecord,
            history,
            source: sourceState.source,
            latestRun: sourceState.latestRun,
        }),
    }
}

module.exports = {
    buildCurrentSourceSubmission,
    fetchPersistedSourceSubmissionRecord,
    fetchRestaurantSourceSubmissionHistoryAuditEvents,
    fetchSourceSubmissionAuditEvents,
    fetchSourceSubmissionState,
}
