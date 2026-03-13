const env = require('./config/env')
const app = require('./app')
const prisma = require('./lib/prisma')
const PORT = env.PORT

let server = null
let shuttingDown = false

function logRuntimeEvent(event, context = {}) {
    console.info(
        JSON.stringify({
            type: 'runtime_event',
            timestamp: new Date().toISOString(),
            event,
            ...context,
        }),
    )
}

async function startServer() {
    server = app.listen(PORT, () => {
        logRuntimeEvent('server.started', { port: PORT, nodeEnv: env.NODE_ENV })
    })
}

async function shutdown(signal, exitCode = 0, error) {
    if (shuttingDown) {
        return
    }

    shuttingDown = true
    logRuntimeEvent('server.shutdown.start', {
        signal,
        ...(error
            ? { errorName: error.name || 'Error', message: error.message, stack: error.stack }
            : {}),
    })

    const forcedExitTimer = setTimeout(() => {
        logRuntimeEvent('server.shutdown.forced', { signal })
        process.exit(1)
    }, 10000)
    forcedExitTimer.unref()

    if (server) {
        await new Promise((resolve, reject) => {
            server.close((closeError) => {
                if (closeError) {
                    reject(closeError)
                } else {
                    resolve()
                }
            })
        })
    }

    try {
        if (typeof prisma.disconnect === 'function') {
            await prisma.disconnect()
        } else if (typeof prisma.$disconnect === 'function') {
            await prisma.$disconnect()
        }
    } catch (disconnectError) {
        logRuntimeEvent('server.shutdown.prisma_error', {
            errorName: disconnectError.name || 'Error',
            message: disconnectError.message,
        })
    }

    clearTimeout(forcedExitTimer)
    logRuntimeEvent('server.shutdown.complete', { signal })
    process.exit(exitCode)
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
    void shutdown('SIGINT')
})

process.on('unhandledRejection', (error) => {
    logRuntimeEvent('process.unhandled_rejection', {
        errorName: error?.name || 'UnhandledRejection',
        message: error?.message,
        stack: error?.stack,
    })
    void shutdown('unhandledRejection', 1, error)
})

process.on('uncaughtException', (error) => {
    logRuntimeEvent('process.uncaught_exception', {
        errorName: error?.name || 'UncaughtException',
        message: error?.message,
        stack: error?.stack,
    })
    void shutdown('uncaughtException', 1, error)
})

startServer().catch((error) => {
    logRuntimeEvent('server.start_failed', {
        errorName: error?.name || 'Error',
        message: error?.message,
        stack: error?.stack,
    })
    process.exit(1)
})
