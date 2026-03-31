const env = require('../../config/env')
const {
    assertSafeRedisDeployment,
    closeReviewCrawlQueueResources,
    createReviewCrawlWorker,
    getRedisConnection,
    isQueueConfigured,
} = require('./review-crawl.queue')
const {
    clearProcessorHeartbeat,
    clearSchedulerHeartbeat,
    logReviewCrawlEvent,
    releaseSchedulerLeadership,
    tryAcquireSchedulerLeadership,
    writeProcessorHeartbeat,
    writeSchedulerHeartbeat,
} = require('./review-crawl.runtime')
const service = require('./review-crawl.service')

async function startReviewCrawlWorkerRuntime(options = {}) {
    if (!isQueueConfigured()) {
        throw new Error('REDIS_URL is required to start the review crawl worker')
    }

    const schedulerIntervalMs =
        options.schedulerIntervalMs ?? env.REVIEW_CRAWL_SCHEDULER_INTERVAL_MS
    const scheduleOnStart = options.scheduleOnStart !== false
    const scheduleImmediately = options.scheduleImmediately !== false
    const runtimeMode = options.runtimeMode ?? env.REVIEW_CRAWL_RUNTIME_MODE
    const runProcessor = runtimeMode === 'processor' || runtimeMode === 'both'
    const runScheduler = runtimeMode === 'scheduler' || runtimeMode === 'both'
    const redis = getRedisConnection()
    const schedulerToken = `${process.pid}:${Date.now()}`

    await assertSafeRedisDeployment(redis)

    const worker = runProcessor
        ? createReviewCrawlWorker((runId, job) =>
              service.processReviewCrawlRun(runId, job),
          )
        : null

    if (worker) {
        worker.on('completed', (job) => {
            logReviewCrawlEvent('worker.job_completed', {
                runId: job?.data?.runId ?? null,
                jobId: job?.id ?? null,
            })
        })

        worker.on('failed', (job, error) => {
            logReviewCrawlEvent('worker.job_failed', {
                runId: job?.data?.runId ?? null,
                jobId: job?.id ?? null,
                errorCode: error?.code ?? null,
                message: error?.message ?? 'Unknown worker error',
            })
        })

        worker.on('error', (error) => {
            logReviewCrawlEvent('worker.runtime_error', {
                errorCode: error?.code ?? null,
                message: error?.message ?? 'Unknown worker runtime error',
            })
        })

        worker.on('stalled', (jobId, previousState) => {
            logReviewCrawlEvent('worker.job_stalled', {
                jobId: jobId ?? null,
                previousState: previousState ?? null,
            })
        })
    }

    let schedulerTimer = null
    let processorHeartbeatTimer = null

    async function maybeScheduleDueRuns(trigger) {
        const isLeader = await tryAcquireSchedulerLeadership(redis, schedulerToken)

        if (!isLeader) {
            return {
                skipped: 'scheduler_not_leader',
            }
        }

        await writeSchedulerHeartbeat(redis, {
            runtimeMode,
            trigger,
        })

        return service.scheduleDueReviewCrawlRuns()
    }

    if (runScheduler && scheduleOnStart) {
        schedulerTimer = setInterval(() => {
            void maybeScheduleDueRuns('interval').catch((error) => {
                logReviewCrawlEvent('scheduler.tick_failed', {
                    errorCode: error?.code ?? null,
                    message:
                        error?.message ?? 'Failed to schedule due review crawl runs',
                })
            })
        }, schedulerIntervalMs)
        schedulerTimer.unref()
    }

    if (runProcessor) {
        processorHeartbeatTimer = setInterval(() => {
            void writeProcessorHeartbeat(redis, {
                runtimeMode,
            }).catch(() => {})
        }, env.REVIEW_CRAWL_HEARTBEAT_INTERVAL_MS)
        processorHeartbeatTimer.unref()
        await writeProcessorHeartbeat(redis, {
            runtimeMode,
            trigger: 'start',
        })
    }

    if (runScheduler && scheduleImmediately) {
        await maybeScheduleDueRuns('start')
    }

    logReviewCrawlEvent('worker.started', {
        concurrency: runProcessor ? env.REVIEW_CRAWL_WORKER_CONCURRENCY : 0,
        schedulerEnabled: runScheduler && scheduleOnStart,
        schedulerIntervalMs,
        runtimeMode,
    })

    let stopped = false

    async function stopWorkerRuntime() {
        if (stopped) {
            return
        }

        stopped = true

        if (schedulerTimer) {
            clearInterval(schedulerTimer)
            schedulerTimer = null
        }

        if (processorHeartbeatTimer) {
            clearInterval(processorHeartbeatTimer)
            processorHeartbeatTimer = null
        }

        if (runProcessor) {
            await clearProcessorHeartbeat(redis).catch(() => {})
        }

        if (runScheduler) {
            const releasedLeadership = await releaseSchedulerLeadership(
                redis,
                schedulerToken,
            ).catch(() => false)

            if (releasedLeadership) {
                await clearSchedulerHeartbeat(redis).catch(() => {})
            }
        }

        if (worker) {
            await worker.close()
        }
        await closeReviewCrawlQueueResources()
    }

    return {
        worker,
        stop: stopWorkerRuntime,
    }
}

module.exports = {
    startReviewCrawlWorkerRuntime,
}
