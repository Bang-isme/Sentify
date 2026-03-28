const path = require('node:path')
const dotenv = require('dotenv')

function loadEnvFiles({ includeReleaseEvidence = false } = {}) {
    const root = path.resolve(__dirname, '..')

    dotenv.config({
        path: path.join(root, '.env'),
    })

    if (includeReleaseEvidence) {
        dotenv.config({
            path: path.join(root, '.env.release-evidence'),
            override: true,
        })
    }
}

module.exports = {
    loadEnvFiles,
}
