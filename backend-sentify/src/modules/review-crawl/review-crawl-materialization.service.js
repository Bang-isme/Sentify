const { badRequest, conflict } = require('../../lib/app-error')
const adminIntakeDomain = require('../admin-intake/admin-intake.domain')
const adminIntakeRepository = require('../admin-intake/admin-intake.repository')
const { buildIntakeBatchTitle, mapRun } = require('./review-crawl.domain')
const repository = require('./review-crawl.repository')

function chunkItems(items, size) {
    const chunks = []

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }

    return chunks
}

async function refreshBatchStatus(batch) {
    const nextStatus = adminIntakeDomain.deriveBatchStatus(batch, batch.items || [])

    if (nextStatus === batch.status) {
        return batch
    }

    return adminIntakeRepository.updateBatch(batch.id, {
        status: nextStatus,
    })
}

function getMaterializationKey(item) {
    return adminIntakeDomain.buildIntakeItemDedupKey(item)
}

async function materializeRunToIntakeInternal({ run, userId }) {
    if (!['COMPLETED', 'PARTIAL'].includes(run.status)) {
        throw conflict(
            'REVIEW_CRAWL_RUN_NOT_MATERIALIZABLE',
            'Only completed or partial crawl runs can be materialized into intake',
        )
    }

    let draftBatch = null

    if (run.intakeBatchId) {
        draftBatch = await adminIntakeRepository.findBatchById(run.intakeBatchId, {
            includeItems: true,
        })

        if (
            draftBatch &&
            !['DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH'].includes(draftBatch.status)
        ) {
            draftBatch = null
        }
    }

    if (
        !draftBatch &&
        run.sourceId &&
        run.source &&
        run.source.provider === 'GOOGLE_MAPS'
    ) {
        draftBatch = await adminIntakeRepository.findOpenBatchByCrawlSourceId(run.sourceId, {
            includeItems: true,
        })
    }

    const rawReviews = await repository.listRunRawReviews(run.id)
    const materializableItems = rawReviews
        .filter((entry) => entry.validForIntake && entry.intakeItemPayload)
        .map((entry) => adminIntakeDomain.normalizeIncomingItem(entry.intakeItemPayload))

    if (materializableItems.length === 0) {
        throw badRequest(
            'REVIEW_CRAWL_NOTHING_TO_MATERIALIZE',
            'This crawl run has no valid review items to materialize',
        )
    }

    if (!draftBatch) {
        draftBatch = await adminIntakeRepository.createBatch({
            restaurantId: run.restaurantId,
            createdByUserId: userId,
            crawlSourceId: run.sourceId ?? null,
            sourceType: 'GOOGLE_MAPS_CRAWL',
            title: buildIntakeBatchTitle(run.source, run),
        })
        draftBatch = await adminIntakeRepository.findBatchById(draftBatch.id, {
            includeItems: true,
        })
    }

    const existingKeys = new Set((draftBatch.items || []).map((item) => getMaterializationKey(item)))
    const newItems = materializableItems.filter((item) => {
        const key = getMaterializationKey(item)

        if (existingKeys.has(key)) {
            return false
        }

        existingKeys.add(key)
        return true
    })

    for (const chunk of chunkItems(newItems, 200)) {
        await adminIntakeRepository.createItems(draftBatch.id, run.restaurantId, chunk)
    }

    let persistedBatch = await adminIntakeRepository.findBatchById(draftBatch.id, {
        includeItems: true,
    })
    persistedBatch = await refreshBatchStatus(persistedBatch)

    await repository.updateRun(run.id, {
        intakeBatchId: draftBatch.id,
    })

    return {
        run: mapRun(
            await repository.findRunById(run.id, {
                includeSource: true,
                includeIntakeBatch: true,
            }),
            {
                includeSource: true,
                includeIntakeBatch: true,
            },
        ),
        batch: adminIntakeDomain.mapBatch(persistedBatch, { includeItems: true }),
        materializedCount: newItems.length,
    }
}

module.exports = {
    materializeRunToIntakeInternal,
}
