import fs from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, '')
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultPlaywrightApiBaseUrl = 'http://127.0.0.1:3100/api'
const defaultPlaywrightWebBaseUrl = 'http://127.0.0.1:4173'
const managedApiBaseUrl =
  normalizeUrl(process.env.PLAYWRIGHT_API_BASE_URL) || defaultPlaywrightApiBaseUrl
const managedWebBaseUrl =
  normalizeUrl(process.env.PLAYWRIGHT_BASE_URL) || defaultPlaywrightWebBaseUrl
const managedApiPort = Number.parseInt(new URL(managedApiBaseUrl).port || '80', 10)
const managedWebPort = Number.parseInt(new URL(managedWebBaseUrl).port || '80', 10)
const managedWebOrigin = new URL(managedWebBaseUrl).origin
const managedQueueName =
  process.env.PLAYWRIGHT_REVIEW_CRAWL_QUEUE_NAME?.trim() || 'review-crawl-playwright'
const managedStackNamespace =
  process.env.PLAYWRIGHT_BACKEND_STACK_NAMESPACE?.trim() || 'playwright-e2e'

export const webRootDir = path.resolve(currentDir, '..', '..')
export const repoRootDir = path.resolve(webRootDir, '..', '..')
export const backendRootDir = path.join(repoRootDir, 'backend-sentify')
const playwrightRuntimeStateFile = path.join(webRootDir, '.playwright-backend-runtime.json')
const playwrightFrontendStateFile = path.join(webRootDir, '.playwright-frontend-runtime.json')
const playwrightFrontendLogFile = path.join(webRootDir, '.playwright-frontend.log')
const managedStackStateFile = path.join(
  backendRootDir,
  '.local-runtime',
  managedStackNamespace,
  'review-crawl-stack.json',
)

interface CommandOptions {
  captureOutput?: boolean
}

export interface ManagedStackStatus {
  config: {
    apiPort: number
    queueName: string
    redisUrl: string | null
    runtimeMode: 'both' | 'processor' | 'scheduler' | string
    stackNamespace?: string | null
  }
  redis: {
    reachable: boolean
    compatible: boolean
    version: string | null
    edition: string | null
    error: string | null
  }
  api: {
    healthy: boolean
    url: string
  }
  worker: {
    processors: Array<{
      pid: number | null
      stale: boolean
      hostname?: string | null
    }>
    scheduler: {
      stale: boolean
      hostname?: string | null
    } | null
  }
}

interface PlaywrightRuntimeOwnership {
  ownership: 'external' | 'managed'
  updatedAt: string
}

interface ManagedFrontendState {
  pid: number
  url: string
  updatedAt: string
}

function formatScriptCommand(scriptRelativePath: string, args: string[]) {
  return `node ${[scriptRelativePath, ...args].join(' ')}`
}

function parseBooleanEnv(name: string) {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function isPidAlive(pid: number) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function buildManagedCorsOrigins() {
  const configuredOrigins = process.env.CORS_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return Array.from(new Set([...(configuredOrigins ?? []), managedWebOrigin])).join(',')
}

function buildWebCommandEnv() {
  return {
    ...process.env,
    VITE_API_BASE_URL: managedApiBaseUrl,
  }
}

function runWebNpmScript(args: string[]) {
  const result = spawnSync('npm', args, {
    cwd: webRootDir,
    env: buildWebCommandEnv(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  })

  if (result.status === 0) {
    return
  }

  throw new Error(`Command failed: npm ${args.join(' ')}`)
}

function runBackendNodeScript(
  scriptRelativePath: string,
  args: string[] = [],
  options: CommandOptions = {},
) {
  const commandEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    PORT: String(managedApiPort),
    APP_URL: managedWebBaseUrl,
    CORS_ORIGIN: buildManagedCorsOrigins(),
    API_RATE_LIMIT_MAX: process.env.API_RATE_LIMIT_MAX || '2000',
    AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX || '50',
    REGISTER_RATE_LIMIT_MAX: process.env.REGISTER_RATE_LIMIT_MAX || '50',
    LOGIN_LOCK_THRESHOLD: process.env.LOGIN_LOCK_THRESHOLD || '50',
    REVIEW_CRAWL_FORCE_STOP: 'true',
    REVIEW_CRAWL_QUEUE_NAME: managedQueueName,
    REVIEW_CRAWL_STACK_NAMESPACE: managedStackNamespace,
  }
  const result = spawnSync(process.execPath, [path.join(backendRootDir, scriptRelativePath), ...args], {
    cwd: backendRootDir,
    env: commandEnv,
    encoding: 'utf8',
    stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.status === 0) {
    return result.stdout ?? ''
  }

  const stderr = result.stderr?.trim()
  const stdout = result.stdout?.trim()
  const details = [stdout, stderr].filter(Boolean).join('\n')

  throw new Error(
    `Command failed: ${formatScriptCommand(scriptRelativePath, args)}${details ? `\n${details}` : ''}`,
  )
}

function parseJsonFromCommandOutput(rawOutput: string) {
  const trimmed = rawOutput.trim()

  if (!trimmed) {
    throw new Error('Expected a JSON payload from the backend command, but received no output.')
  }

  const braceIndices = Array.from(trimmed.matchAll(/\{/g), (match) => match.index ?? -1).filter(
    (index) => index >= 0,
  )

  if (braceIndices.length === 0) {
    throw new Error(`Expected a JSON payload from the backend command, but received:\n${trimmed}`)
  }

  for (const braceIndex of braceIndices) {
    try {
      return JSON.parse(trimmed.slice(braceIndex))
    } catch {}
  }

  throw new Error(`Expected a JSON payload from the backend command, but could not parse:\n${trimmed}`)
}

function terminatePid(pid: number) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  } else {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {}
  }

  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return
    }
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch {}
}

async function waitForPortToClear(port: number, timeoutMs = 10_000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!findListeningPid(port)) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timed out waiting for port ${port} to clear after isolated stack cleanup.`)
}

function findListeningPid(port: number) {
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`,
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    )
    const value = result.stdout?.trim()
    return value ? Number.parseInt(value, 10) : null
  }

  const result = spawnSync('lsof', ['-ti', `tcp:${port}`], {
    encoding: 'utf8',
  })
  const value = result.stdout?.trim().split(/\s+/).find(Boolean)
  return value ? Number.parseInt(value, 10) : null
}

interface NodeProcessSnapshot {
  ProcessId?: number
  CommandLine?: string | null
}

function listPotentiallyConflictingRepoNodeProcesses() {
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress',
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    )

    const raw = result.stdout?.trim()
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw) as NodeProcessSnapshot | NodeProcessSnapshot[]
      const rows = Array.isArray(parsed) ? parsed : [parsed]

      return rows
        .map((row) => ({
          pid: row.ProcessId ?? null,
          commandLine: row.CommandLine ?? null,
        }))
        .filter(
          (row): row is { pid: number; commandLine: string | null } =>
            Number.isFinite(row.pid) && row.pid > 0,
        )
    } catch {
      return []
    }
  }

  const result = spawnSync('ps', ['-eo', 'pid=,args='], {
    encoding: 'utf8',
  })

  return (result.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/)
      if (!match) {
        return null
      }

      return {
        pid: Number.parseInt(match[1], 10),
        commandLine: match[2] ?? null,
      }
    })
    .filter((row): row is { pid: number; commandLine: string | null } => Boolean(row?.pid))
}

function collectConflictingRepoLocalProcessPids() {
  const commandMatchers = [
    /src[\\/]+server\.js(?:\s|$)/i,
    /nodemon(?:\.js)?["']?\s+src[\\/]+server\.js/i,
    /src[\\/]+review-crawl-worker\.js(?:\s|$)/i,
    /prisma(?:[\\/].*build[\\/]+index\.js)?["']?\s+migrate\s+dev/i,
    /npx-cli\.js["']?\s+prisma\s+migrate\s+dev/i,
  ]

  return Array.from(
    new Set(
      listPotentiallyConflictingRepoNodeProcesses()
        .filter((row) => row.pid !== process.pid)
        .filter((row) => commandMatchers.some((pattern) => pattern.test(row.commandLine ?? '')))
        .map((row) => row.pid),
    ),
  )
}

function collectConflictingFrontendProcessPids() {
  const commandMatchers = [
    /node_modules[\\/]+vite[\\/]+bin[\\/]+vite\.js["']?\s+preview/i,
    /scripts[\\/]+playwright-preview\.js/i,
    /apps[\\/]web/i,
  ]

  return Array.from(
    new Set(
      listPotentiallyConflictingRepoNodeProcesses()
        .filter((row) => row.pid !== process.pid)
        .filter((row) => commandMatchers.some((pattern) => pattern.test(row.commandLine ?? '')))
        .map((row) => row.pid),
    ),
  )
}

export async function forceCleanupManagedIsolatedStack() {
  const collectActiveWorkerPids = () => {
    const pids = new Set<number>()

    try {
      const status = getBackendStackStatus()
      for (const processor of status.worker.processors) {
        if (processor.pid && !processor.stale) {
          pids.add(processor.pid)
        }
      }
    } catch {}

    return pids
  }

  const terminateKnownManagedProcesses = () => {
    for (const pid of collectActiveWorkerPids()) {
      terminatePid(pid)
    }

    const apiPid = findListeningPid(managedApiPort)
    if (apiPid) {
      terminatePid(apiPid)
    }

    for (const pid of collectConflictingRepoLocalProcessPids()) {
      terminatePid(pid)
    }
  }

  terminateKnownManagedProcesses()

  if (fs.existsSync(managedStackStateFile)) {
    fs.unlinkSync(managedStackStateFile)
  }

  const workerCleanupDeadline = Date.now() + 10_000
  while (Date.now() < workerCleanupDeadline) {
    const remainingWorkerPids = Array.from(collectActiveWorkerPids())

    if (remainingWorkerPids.length === 0) {
      break
    }

    for (const pid of remainingWorkerPids) {
      terminatePid(pid)
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  await waitForPortToClear(managedApiPort)
}

function readManagedFrontendState() {
  if (!fs.existsSync(playwrightFrontendStateFile)) {
    return null
  }

  try {
    return JSON.parse(
      fs.readFileSync(playwrightFrontendStateFile, 'utf8'),
    ) as ManagedFrontendState
  } catch {
    return null
  }
}

function writeManagedFrontendState(state: ManagedFrontendState) {
  fs.writeFileSync(playwrightFrontendStateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function clearManagedFrontendState() {
  if (fs.existsSync(playwrightFrontendStateFile)) {
    fs.unlinkSync(playwrightFrontendStateFile)
  }
}

async function waitForHttpOk(url: string, timeoutMs = 120_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  const targetUrl = new URL(url)
  const requestImpl = targetUrl.protocol === 'https:' ? https : http

  while (Date.now() < deadline) {
    try {
      const statusCode = await new Promise<number>((resolve, reject) => {
        const request = requestImpl.request(
          targetUrl,
          {
            method: 'GET',
          },
          (response) => {
            response.resume()
            resolve(response.statusCode ?? 0)
          },
        )

        request.once('error', reject)
        request.setTimeout(5_000, () => {
          request.destroy(new Error(`Timed out while probing ${url}`))
        })
        request.end()
      })

      if (statusCode >= 200 && statusCode < 400) {
        return
      }

      lastError = new Error(`Unexpected status ${statusCode} from ${url}`)
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error(`Timed out waiting for ${url} to become reachable.`)
}

export async function cleanupManagedFrontendServer() {
  const frontendState = readManagedFrontendState()
  const pidsToTerminate = new Set<number>()

  if (frontendState?.pid) {
    pidsToTerminate.add(frontendState.pid)
  }

  for (const pid of collectConflictingFrontendProcessPids()) {
    pidsToTerminate.add(pid)
  }

  const listeningPid = findListeningPid(managedWebPort)
  if (listeningPid) {
    pidsToTerminate.add(listeningPid)
  }

  for (const pid of pidsToTerminate) {
    terminatePid(pid)
  }

  clearManagedFrontendState()

  if (findListeningPid(managedWebPort)) {
    await waitForPortToClear(managedWebPort)
  }
}

export async function startManagedFrontendServer() {
  const preexistingPid = findListeningPid(managedWebPort)

  if (preexistingPid) {
    await cleanupManagedFrontendServer()

    const retryPid = findListeningPid(managedWebPort)
    if (retryPid) {
      throw new Error(
        `Managed frontend port ${managedWebPort} is already in use by PID ${retryPid}.`,
      )
    }
  }

  fs.writeFileSync(playwrightFrontendLogFile, '', 'utf8')
  runWebNpmScript(['run', 'build'])
  const logFd = fs.openSync(playwrightFrontendLogFile, 'a')
  const child = spawn(
    process.execPath,
    [
      path.join(webRootDir, 'node_modules', 'vite', 'bin', 'vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(managedWebPort),
      '--strictPort',
    ],
    {
      cwd: webRootDir,
      env: buildWebCommandEnv(),
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
    },
  )

  child.unref()
  fs.closeSync(logFd)

  writeManagedFrontendState({
    pid: child.pid ?? 0,
    url: managedWebBaseUrl,
    updatedAt: new Date().toISOString(),
  })

  try {
    await waitForHttpOk(managedWebBaseUrl)
  } catch (error) {
    await cleanupManagedFrontendServer()
    throw error
  }
}

export function shouldSkipDbReset() {
  return parseBooleanEnv('PLAYWRIGHT_SKIP_DB_RESET')
}

export function shouldPreserveBackendStack() {
  return parseBooleanEnv('PLAYWRIGHT_PRESERVE_BACKEND_STACK')
}

export function runBackendReset() {
  runBackendNodeScript('scripts/reset-local-baseline.js')
}

export function startManagedBackendStack() {
  const output = runBackendNodeScript('scripts/local-review-stack.js', ['start'], {
    captureOutput: true,
  }).trim()

  return parseJsonFromCommandOutput(output) as ManagedStackStatus
}

export function getBackendStackStatus() {
  const output = runBackendNodeScript('scripts/local-review-stack.js', ['status'], {
    captureOutput: true,
  }).trim()

  return parseJsonFromCommandOutput(output) as ManagedStackStatus
}

export async function waitForHealthyBackendStatus(timeoutMs = 20_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      const status = getBackendStackStatus()
      assertManagedStackHealthy(status)
      return status
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error('Timed out waiting for a healthy backend stack status.')
}

export function stopManagedBackendStack() {
  const output = runBackendNodeScript('scripts/local-review-stack.js', ['stop'], {
    captureOutput: true,
  }).trim()

  return output ? parseJsonFromCommandOutput(output) : null
}

export function assertManagedStackHealthy(status: ManagedStackStatus) {
  if (!status.redis.reachable || !status.redis.compatible) {
    throw new Error(
      `Managed backend stack Redis is not healthy: ${status.redis.error ?? status.redis.version ?? 'unknown error'}`,
    )
  }

  if (!status.api.healthy) {
    throw new Error(`Managed backend stack API is not healthy at ${status.api.url}.`)
  }

  const expectsProcessor =
    status.config.runtimeMode === 'processor' || status.config.runtimeMode === 'both'
  const expectsScheduler =
    status.config.runtimeMode === 'scheduler' || status.config.runtimeMode === 'both'
  const activeProcessorCount = status.worker.processors.filter((entry) => !entry.stale).length
  const schedulerReady = Boolean(status.worker.scheduler && !status.worker.scheduler.stale)

  if (expectsProcessor && activeProcessorCount === 0) {
    throw new Error('Managed backend stack has no active review-crawl processor heartbeat.')
  }

  if (expectsScheduler && !schedulerReady) {
    throw new Error('Managed backend stack has no active review-crawl scheduler heartbeat.')
  }
}

export function summarizeManagedStack(status: ManagedStackStatus) {
  const activeProcessorCount = status.worker.processors.filter((entry) => !entry.stale).length
  const schedulerReady = Boolean(status.worker.scheduler && !status.worker.scheduler.stale)

  return {
    api: status.api.url,
    redisVersion: status.redis.version,
    redisEdition: status.redis.edition,
    runtimeMode: status.config.runtimeMode,
    stackNamespace: status.config.stackNamespace ?? null,
    activeProcessorCount,
    schedulerReady,
  }
}

export function recordPlaywrightRuntimeOwnership(ownership: PlaywrightRuntimeOwnership['ownership']) {
  fs.writeFileSync(
    playwrightRuntimeStateFile,
    `${JSON.stringify(
      {
        ownership,
        updatedAt: new Date().toISOString(),
      } satisfies PlaywrightRuntimeOwnership,
      null,
      2,
    )}\n`,
    'utf8',
  )
}

export function readPlaywrightRuntimeOwnership() {
  if (!fs.existsSync(playwrightRuntimeStateFile)) {
    return null
  }

  try {
    return JSON.parse(
      fs.readFileSync(playwrightRuntimeStateFile, 'utf8'),
    ) as PlaywrightRuntimeOwnership
  } catch {
    return null
  }
}

export function clearPlaywrightRuntimeOwnership() {
  if (fs.existsSync(playwrightRuntimeStateFile)) {
    fs.unlinkSync(playwrightRuntimeStateFile)
  }
}

export function prefersManagedIsolatedStack() {
  return managedStackNamespace.length > 0 || managedApiPort !== 3000 || managedQueueName !== 'review-crawl'
}
