const env = require('../../config/env')
const prisma = require('../../lib/prisma')
const { appendAuditEvent } = require('../../services/audit-event.service')
const {
    PERSISTED_SOURCE_SUBMISSION_STATUS,
    SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION,
    SOURCE_SUBMISSION_SCHEDULING_LANE,
    buildSourceSubmissionAuditSnapshot,
} = require('../../services/restaurant-state.service')
const repository = require('./review-crawl.repository')

const SOURCE_SUBMISSION_BOOTSTRAP_LEASE_MINUTES = 10
const READY_FOR_SOURCE_LINK_SUBMISSION_STATUS =
    PERSISTED_SOURCE_SUBMISSION_STATUS.READY_FOR_SOURCE_LINK
const LINKED_TO_SOURCE_SUBMISSION_STATUS =
    PERSISTED_SOURCE_SUBMISSION_STATUS.LINKED_TO_SOURCE
const SOURCE_SUBMISSION_SCHEDULER_SELECT = {
    id: true,
    restaurantId: true,
    provider: true,
    inputUrl: true,
    normalizedUrl: true,
    canonicalCid: true,
    placeHexId: true,
    googlePlaceId: true,
    placeName: true,
    dedupeKey: true,
    schedulingLane: true,
    linkedSourceId: true,
    submittedAt: true,
    claimedByUserId: true,
    claimedAt: true,
    claimExpiresAt: true,
}

function addMinutes(value, minutes) {
    return new Date(value.getTime() + minutes * 60 * 1000)
}

function getSourceSubmissionLaneScore(schedulingLane) {
    if (schedulingLane === SOURCE_SUBMISSION_SCHEDULING_LANE.PRIORITY) {
        return 2
    }

    return 1
}

function mapSourceSubmissionLaneToRunPriority(schedulingLane) {
    if (schedulingLane === SOURCE_SUBMISSION_SCHEDULING_LANE.PRIORITY) {
        return 'HIGH'
    }

    return 'NORMAL'
}

function buildEmptySourceSubmissionBootstrapSummary() {
    return {
        claimedGroupCount: 0,
        processedSubmissionCount: 0,
        linkedSubmissionCount: 0,
        queuedRunCount: 0,
        reusedRunCount: 0,
        queueFailureCount: 0,
        sourceFailureCount: 0,
    }
}

function resolveSourceSubmissionBootstrapMaxPerTick(controls) {
    if (!controls?.sourceSubmissionAutoBootstrapEnabled) {
        return 0
    }

    const configuredMax = Number.isInteger(
        controls.sourceSubmissionAutoBootstrapMaxPerTick,
    )
        ? controls.sourceSubmissionAutoBootstrapMaxPerTick
        : env.REVIEW_CRAWL_SCHEDULER_BATCH_SIZE

    return Math.max(
        Math.min(configuredMax, env.REVIEW_CRAWL_SCHEDULER_BATCH_SIZE),
        0,
    )
}

function buildResolvedPlaceFromSourceSubmission(submission) {
    return {
        source: {
            resolvedUrl: submission.normalizedUrl ?? submission.inputUrl,
        },
        place: {
            name: submission.placeName ?? null,
            totalReviewCount: null,
            identifiers: {
                cid: submission.canonicalCid ?? null,
                placeHexId: submission.placeHexId ?? null,
                googlePlaceId: submission.googlePlaceId ?? null,
            },
        },
    }
}

function buildBootstrapSourceInput(submission) {
    return {
        restaurantId: submission.restaurantId,
        url: submission.inputUrl,
        language: 'en',
        region: 'us',
        syncEnabled: true,
    }
}

function buildReadySourceSubmissionGroups(submissions) {
    const groupsByKey = new Map()

    for (const submission of submissions) {
        const existingGroup = groupsByKey.get(submission.dedupeKey)

        if (!existingGroup) {
            groupsByKey.set(submission.dedupeKey, {
                dedupeKey: submission.dedupeKey,
                schedulingLane:
                    submission.schedulingLane ??
                    SOURCE_SUBMISSION_SCHEDULING_LANE.STANDARD,
                oldestSubmittedAt: submission.submittedAt,
                submissions: [submission],
            })
            continue
        }

        existingGroup.submissions.push(submission)

        if (
            getSourceSubmissionLaneScore(submission.schedulingLane) >
            getSourceSubmissionLaneScore(existingGroup.schedulingLane)
        ) {
            existingGroup.schedulingLane = submission.schedulingLane
        }

        if (submission.submittedAt < existingGroup.oldestSubmittedAt) {
            existingGroup.oldestSubmittedAt = submission.submittedAt
        }
    }

    return [...groupsByKey.values()].sort((left, right) => {
        const laneDelta =
            getSourceSubmissionLaneScore(right.schedulingLane) -
            getSourceSubmissionLaneScore(left.schedulingLane)

        if (laneDelta !== 0) {
            return laneDelta
        }

        return (
            new Date(left.oldestSubmittedAt).getTime() -
            new Date(right.oldestSubmittedAt).getTime()
        )
    })
}

async function listReadySourceSubmissionCandidates({ now, take }) {
    if (take <= 0) {
        return []
    }

    const priorityCandidates = await prisma.restaurantSourceSubmission.findMany({
        where: {
            provider: 'GOOGLE_MAPS',
            status: READY_FOR_SOURCE_LINK_SUBMISSION_STATUS,
            linkedSourceId: null,
            schedulingLane: SOURCE_SUBMISSION_SCHEDULING_LANE.PRIORITY,
            OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lte: now } }],
        },
        select: SOURCE_SUBMISSION_SCHEDULER_SELECT,
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
        take,
    })
    const standardCandidates = await prisma.restaurantSourceSubmission.findMany({
        where: {
            provider: 'GOOGLE_MAPS',
            status: READY_FOR_SOURCE_LINK_SUBMISSION_STATUS,
            linkedSourceId: null,
            schedulingLane: SOURCE_SUBMISSION_SCHEDULING_LANE.STANDARD,
            OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lte: now } }],
        },
        select: SOURCE_SUBMISSION_SCHEDULER_SELECT,
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
        take,
    })

    return [...priorityCandidates, ...standardCandidates]
}

async function claimReadySourceSubmissionGroup(group, now) {
    const claimedAt = now
    const claimExpiresAt = addMinutes(now, SOURCE_SUBMISSION_BOOTSTRAP_LEASE_MINUTES)

    const result = await prisma.restaurantSourceSubmission.updateMany({
        where: {
            provider: 'GOOGLE_MAPS',
            status: READY_FOR_SOURCE_LINK_SUBMISSION_STATUS,
            linkedSourceId: null,
            dedupeKey: group.dedupeKey,
            OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lte: now } }],
        },
        data: {
            claimedByUserId: null,
            claimedAt,
            claimExpiresAt,
        },
    })

    if (result.count === 0) {
        return null
    }

    const claimedSubmissions = await prisma.restaurantSourceSubmission.findMany({
        where: {
            provider: 'GOOGLE_MAPS',
            status: READY_FOR_SOURCE_LINK_SUBMISSION_STATUS,
            linkedSourceId: null,
            dedupeKey: group.dedupeKey,
            claimedAt,
            claimExpiresAt,
        },
        select: SOURCE_SUBMISSION_SCHEDULER_SELECT,
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    })

    if (claimedSubmissions.length === 0) {
        return null
    }

    return {
        dedupeKey: group.dedupeKey,
        schedulingLane: group.schedulingLane,
        submissions: claimedSubmissions,
    }
}

async function releaseSourceSubmissionClaim(submissionId) {
    await prisma.restaurantSourceSubmission.update({
        where: {
            id: submissionId,
        },
        data: {
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
        },
    })
}

async function markSourceSubmissionLinked({ submission, source, now }) {
    return prisma.restaurantSourceSubmission.update({
        where: {
            id: submission.id,
        },
        data: {
            linkedSourceId: source.id,
            normalizedUrl:
                source.resolvedUrl ?? submission.normalizedUrl ?? submission.inputUrl,
            canonicalCid: source.canonicalCid ?? submission.canonicalCid,
            placeHexId: source.placeHexId ?? submission.placeHexId,
            googlePlaceId: source.googlePlaceId ?? submission.googlePlaceId,
            placeName: source.placeName ?? submission.placeName,
            status: LINKED_TO_SOURCE_SUBMISSION_STATUS,
            recommendationCode:
                SOURCE_SUBMISSION_PREVIEW_RECOMMENDATION.ALREADY_CONNECTED,
            recommendationMessage:
                'This Google Maps place was linked automatically and queued for sync.',
            claimedByUserId: null,
            claimedAt: null,
            claimExpiresAt: null,
            lastResolvedAt: now,
        },
    })
}

module.exports = {
    bootstrapReadySourceSubmissions: async ({
        now,
        maxSubmissions,
        createQueuedRunForSource,
        persistResolvedReviewCrawlSource,
    }) => {
        const summary = buildEmptySourceSubmissionBootstrapSummary()

        if (maxSubmissions <= 0) {
            return summary
        }

        const candidateTake = Math.max(maxSubmissions * 4, maxSubmissions)
        const candidates = await listReadySourceSubmissionCandidates({
            now,
            take: candidateTake,
        })
        const groups = buildReadySourceSubmissionGroups(candidates)

        for (const group of groups) {
            if (summary.processedSubmissionCount >= maxSubmissions) {
                break
            }

            if (
                summary.processedSubmissionCount > 0 &&
                summary.processedSubmissionCount + group.submissions.length >
                    maxSubmissions
            ) {
                break
            }

            const claimedGroup = await claimReadySourceSubmissionGroup(group, now)

            if (!claimedGroup) {
                continue
            }

            summary.claimedGroupCount += 1
            summary.processedSubmissionCount += claimedGroup.submissions.length

            for (const submission of claimedGroup.submissions) {
                const bootstrapInput = buildBootstrapSourceInput(submission)

                try {
                    const createdSource = await persistResolvedReviewCrawlSource({
                        userId: null,
                        input: bootstrapInput,
                        resolved: buildResolvedPlaceFromSourceSubmission(submission),
                    })

                    const linkedSubmission = await markSourceSubmissionLinked({
                        submission,
                        source: createdSource.source,
                        now,
                    })

                    let runResult = null
                    let queueError = null

                    try {
                        runResult = await createQueuedRunForSource({
                            source: createdSource.source,
                            userId: null,
                            input: {
                                strategy: 'INCREMENTAL',
                                priority: mapSourceSubmissionLaneToRunPriority(
                                    submission.schedulingLane,
                                ),
                            },
                            trigger: 'source_submission_scheduler',
                            metadata: {
                                sourceSubmissionId: submission.id,
                                sourceSubmissionDedupeKey: group.dedupeKey,
                                sourceSubmissionSchedulingLane:
                                    submission.schedulingLane ??
                                    SOURCE_SUBMISSION_SCHEDULING_LANE.STANDARD,
                            },
                            reuseActiveRun: true,
                        })
                    } catch (error) {
                        queueError = error

                        if (
                            createdSource.source.status === 'ACTIVE' &&
                            createdSource.source.syncEnabled
                        ) {
                            await repository.updateSource(createdSource.source.id, {
                                nextScheduledAt: now,
                            }).catch(() => {})
                        }
                    }

                    await appendAuditEvent({
                        action: queueError
                            ? 'SCHEDULER_SOURCE_SUBMISSION_LINKED_WITH_QUEUE_ERROR'
                            : 'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAPPED',
                        resourceType: 'restaurantSourceSubmission',
                        resourceId: submission.id,
                        restaurantId: submission.restaurantId,
                        actorUserId: null,
                        summary: queueError
                            ? `Scheduler linked the merchant source submission for restaurant ${submission.restaurantId}, but the initial crawl run still needs a retry.`
                            : `Scheduler linked the merchant source submission for restaurant ${submission.restaurantId} and queued the initial crawl run.`,
                        metadata: {
                            dedupeKey: group.dedupeKey,
                            schedulingLane:
                                submission.schedulingLane ??
                                SOURCE_SUBMISSION_SCHEDULING_LANE.STANDARD,
                            crawlSourceId: createdSource.source.id,
                            crawlRunId: runResult?.run?.id ?? null,
                            reusedExistingRun: runResult?.reusedExisting ?? false,
                            sourceSubmissionSnapshot:
                                buildSourceSubmissionAuditSnapshot(linkedSubmission),
                            queueError: queueError
                                ? {
                                      code:
                                          queueError.code ??
                                          'SOURCE_SUBMISSION_INITIAL_RUN_QUEUE_FAILED',
                                      message: queueError.message,
                                  }
                                : null,
                        },
                    })

                    summary.linkedSubmissionCount += 1

                    if (runResult?.run) {
                        if (runResult.reusedExisting === true) {
                            summary.reusedRunCount += 1
                        } else {
                            summary.queuedRunCount += 1
                        }
                    }

                    if (queueError?.code) {
                        summary.queueFailureCount += 1
                    }
                } catch (error) {
                    await releaseSourceSubmissionClaim(submission.id)

                    await appendAuditEvent({
                        action: 'SCHEDULER_SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
                        resourceType: 'restaurantSourceSubmission',
                        resourceId: submission.id,
                        restaurantId: submission.restaurantId,
                        actorUserId: null,
                        summary: `Scheduler could not bootstrap the merchant source submission for restaurant ${submission.restaurantId}.`,
                        metadata: {
                            dedupeKey: group.dedupeKey,
                            errorCode:
                                error.code ?? 'SOURCE_SUBMISSION_BOOTSTRAP_FAILED',
                            message: error.message,
                            sourceSubmissionSnapshot:
                                buildSourceSubmissionAuditSnapshot(submission),
                        },
                    })

                    summary.sourceFailureCount += 1
                }
            }
        }

        return summary
    },
    buildEmptySourceSubmissionBootstrapSummary,
    resolveSourceSubmissionBootstrapMaxPerTick,
}
