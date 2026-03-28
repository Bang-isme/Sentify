import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'

function normalizeUrl(value) {
  return value?.trim().replace(/\/$/, '')
}

function resolvePreviewPort() {
  const baseUrl = normalizeUrl(process.env.PLAYWRIGHT_BASE_URL) || 'http://127.0.0.1:4173'

  try {
    const url = new URL(baseUrl)
    return Number.parseInt(url.port || '80', 10)
  } catch {
    return 4173
  }
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

function reclaimPreviewPort() {
  const previewPort = resolvePreviewPort()
  const pids = Array.from(new Set(readListeningPids(previewPort)))

  if (!pids.length) {
    return
  }

  console.log(
    `[playwright-runner] Reclaiming Playwright preview port ${previewPort} from process(es): ${pids.join(', ')}`,
  )

  for (const pid of pids) {
    terminatePidTree(pid)
  }
}

reclaimPreviewPort()
const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)]
const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx', ...playwrightArgs], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
        shell: false,
      })
    : spawn('npx', playwrightArgs, {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
        shell: false,
      })

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', forwardSignal)
process.on('SIGTERM', forwardSignal)

child.on('exit', (code, signal) => {
  process.removeListener('SIGINT', forwardSignal)
  process.removeListener('SIGTERM', forwardSignal)

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
