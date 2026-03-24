const env = require('../../config/env')
const {
    closeReviewCrawlQueueResources,
    createReviewCrawlWorker,
    isQueueConfigured,
} = require('./review-crawl.queue')
const { logReviewCrawlEvent } = require('./review-crawl.runtime')
const service = require('./review-crawl.service')

async function startReviewCrawlWorkerRuntime(options = {}) {
    if (!isQueueConfigured()) {
        throw new Error('REDIS_URL is required to start the review crawl worker')
    }

    const schedulerIntervalMs =
        options.schedulerIntervalMs ?? env.REVIEW_CRAWL_SCHEDULER_INTERVAL_MS
    const scheduleOnStart = options.scheduleOnStart !== false
    const scheduleImmediately = options.scheduleImmediately !== false

    const worker = createReviewCrawlWorker((runId, job) =>
        service.processReviewCrawlRun(runId, job),
    )

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

    let schedulerTimer = null

    if (scheduleOnStart) {
        schedulerTimer = setInterval(() => {
            void service.scheduleDueReviewCrawlRuns().catch((error) => {
                logReviewCrawlEvent('scheduler.tick_failed', {
                    errorCode: error?.code ?? null,
                    message:
                        error?.message ?? 'Failed to schedule due review crawl runs',
                })
            })
        }, schedulerIntervalMs)
        schedulerTimer.unref()
    }

    if (scheduleImmediately) {
        await service.scheduleDueReviewCrawlRuns()
    }

    logReviewCrawlEvent('worker.started', {
        concurrency: env.REVIEW_CRAWL_WORKER_CONCURRENCY,
        schedulerEnabled: scheduleOnStart,
        schedulerIntervalMs,
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

        await worker.close()
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
