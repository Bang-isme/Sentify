const env = require('./config/env')
const app = require('./app')
const { recoverStaleImportRuns } = require('./services/review-import-run.service')

const PORT = env.PORT

function logStartupFailure(error) {
    const isImportRunClientMismatch =
        error?.name === 'PrismaClientValidationError' &&
        typeof error?.message === 'string' &&
        error.message.includes('Unknown argument `phase`')

    if (isImportRunClientMismatch) {
        console.error(
            JSON.stringify({
                type: 'runtime_event',
                timestamp: new Date().toISOString(),
                event: 'server.startup.failed',
                errorCode: 'PRISMA_CLIENT_SCHEMA_MISMATCH',
                message:
                    'Prisma Client is out of date with the ImportRun schema. Run `npm run db:generate` and fully restart the backend process.',
            }),
        )
    }

    console.error(error)
}

async function startServer() {
    await recoverStaleImportRuns()

    app.listen(PORT, () => {
        console.info(
            JSON.stringify({
                type: 'runtime_event',
                timestamp: new Date().toISOString(),
                event: 'server.started',
                port: PORT,
                nodeEnv: env.NODE_ENV,
            }),
        )
    })
}

startServer().catch((error) => {
    logStartupFailure(error)
    process.exit(1)
})
