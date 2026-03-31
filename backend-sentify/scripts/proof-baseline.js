const { spawnSync } = require('node:child_process')
const path = require('node:path')

function resolveNpmCommand() {
    if (process.env.npm_execpath) {
        return {
            command: process.execPath,
            args: [process.env.npm_execpath],
        }
    }

    if (process.platform === 'win32') {
        return {
            command: process.env.comspec || 'cmd.exe',
            args: ['/d', '/s', '/c', 'npm run db:reset:local-baseline'],
        }
    }

    return {
        command: 'npm',
        args: [],
    }
}

function runResetBaseline() {
    const npmCommand = resolveNpmCommand()

    const reset = spawnSync(
        npmCommand.command,
        process.env.npm_execpath
            ? [...npmCommand.args, 'run', 'db:reset:local-baseline']
            : npmCommand.args,
        {
            cwd: path.resolve(__dirname, '..'),
            env: process.env,
            stdio: 'inherit',
        },
    )

    if (reset.error) {
        throw reset.error
    }

    if ((reset.status ?? 1) !== 0) {
        throw new Error(
            `db:reset:local-baseline failed with exit code ${reset.status ?? 1}`,
        )
    }
}

module.exports = {
    runResetBaseline,
}
