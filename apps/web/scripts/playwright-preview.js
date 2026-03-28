import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'

function parsePreviewPort(extraArgs) {
  const portFlagIndex = extraArgs.findIndex((argument) => argument === '--port')
  if (portFlagIndex !== -1) {
    const explicitPort = Number.parseInt(extraArgs[portFlagIndex + 1] ?? '', 10)
    if (Number.isFinite(explicitPort) && explicitPort > 0) {
      return explicitPort
    }
  }

  const shortPortFlag = extraArgs.find((argument) => argument.startsWith('--port='))
  if (shortPortFlag) {
    const explicitPort = Number.parseInt(shortPortFlag.split('=')[1] ?? '', 10)
    if (Number.isFinite(explicitPort) && explicitPort > 0) {
      return explicitPort
    }
  }

  return 4173
}

function buildSpawnOptions() {
  return {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  }
}

function buildPreviewArgs(extraArgs) {
  return ['run', 'preview', '--', ...extraArgs]
}

function readListeningPids(port) {
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess)`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        windowsHide: true,
      },
    )

    return (result.stdout ?? '')
      .split(/\r?\n/)
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
  }

  const result = spawnSync('lsof', ['-ti', `tcp:${port}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  return (result.stdout ?? '')
    .split(/\s+/)
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function terminatePidTree(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }

  spawnSync('kill', ['-TERM', String(pid)], {
    cwd: process.cwd(),
    stdio: 'ignore',
  })
}

function cleanupPreviewPort(port) {
  const pids = Array.from(new Set(readListeningPids(port)))

  if (!pids.length) {
    return
  }

  console.log(`[playwright-preview] Reclaiming port ${port} from stale process(es): ${pids.join(', ')}`)

  for (const pid of pids) {
    terminatePidTree(pid)
  }
}

function runBuild() {
  const result = spawnSync('npm', ['run', 'build'], buildSpawnOptions())

  if (result.error) {
    throw result.error
  }

  if (result.status === 0) {
    return
  }

  process.exit(result.status ?? 1)
}

function forwardSignal(signal, child) {
  if (!child.killed) {
    child.kill(signal)
  }
}

const previewArgs = process.argv.slice(2)
const previewPort = parsePreviewPort(previewArgs)
cleanupPreviewPort(previewPort)
runBuild()
cleanupPreviewPort(previewPort)

const previewProcess = spawn('npm', buildPreviewArgs(previewArgs), buildSpawnOptions())

const shutdown = (signal) => forwardSignal(signal, previewProcess)

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('exit', () => {
  if (!previewProcess.killed) {
    previewProcess.kill()
  }
})

previewProcess.on('exit', (code, signal) => {
  process.removeListener('SIGINT', shutdown)
  process.removeListener('SIGTERM', shutdown)

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
