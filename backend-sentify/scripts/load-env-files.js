const path = require('node:path')
const dotenv = require('dotenv')

function loadEnvFiles({ includeReleaseEvidence = false } = {}) {
    const root = path.resolve(__dirname, '..')
    const runtimeEnvPath = process.env.SENTIFY_RUNTIME_ENV_FILE
        ? path.resolve(process.env.SENTIFY_RUNTIME_ENV_FILE)
        : path.join(root, '.env')
    const releaseEnvPath = process.env.SENTIFY_RELEASE_EVIDENCE_ENV_FILE
        ? path.resolve(process.env.SENTIFY_RELEASE_EVIDENCE_ENV_FILE)
        : path.join(root, '.env.release-evidence')

    dotenv.config({
        path: runtimeEnvPath,
    })

    if (includeReleaseEvidence) {
        dotenv.config({
            path: releaseEnvPath,
            override: true,
        })
    }
}

module.exports = {
    loadEnvFiles,
}
