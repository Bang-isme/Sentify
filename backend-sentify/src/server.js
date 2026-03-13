const env = require('./config/env')
const app = require('./app')
const PORT = env.PORT

async function startServer() {
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
    console.error(error)
    process.exit(1)
})
