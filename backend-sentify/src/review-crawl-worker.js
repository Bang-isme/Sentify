const prisma = require('./lib/prisma')
const { logReviewCrawlEvent } = require('./modules/review-crawl/review-crawl.runtime')
const {
    startReviewCrawlWorkerRuntime,
} = require('./modules/review-crawl/review-crawl.worker-runtime')

let runtime = null
let shuttingDown = false

async function startWorker() {
    runtime = await startReviewCrawlWorkerRuntime()
}

async function shutdown(signal, exitCode = 0, error) {
    if (shuttingDown) {
        return
    }

    shuttingDown = true
    logReviewCrawlEvent('worker.shutdown.start', {
        signal,
        ...(error
            ? {
                  errorCode: error.code ?? null,
                  message: error.message,
                  stack: error.stack,
              }
            : {}),
    })

    if (runtime) {
        await runtime.stop()
        runtime = null
    }

    try {
        if (typeof prisma.disconnect === 'function') {
            await prisma.disconnect()
        } else if (typeof prisma.$disconnect === 'function') {
            await prisma.$disconnect()
        }
    } catch (disconnectError) {
        logReviewCrawlEvent('worker.shutdown.prisma_error', {
            message: disconnectError.message,
        })
    }

    logReviewCrawlEvent('worker.shutdown.complete', { signal })
    process.exit(exitCode)
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
    void shutdown('SIGINT')
})

process.on('unhandledRejection', (error) => {
    void shutdown('unhandledRejection', 1, error)
})

process.on('uncaughtException', (error) => {
    void shutdown('uncaughtException', 1, error)
})

startWorker().catch((error) => {
    logReviewCrawlEvent('worker.start_failed', {
        errorCode: error?.code ?? null,
        message: error?.message ?? 'Failed to start review crawl worker',
        stack: error?.stack,
    })
    process.exit(1)
})
