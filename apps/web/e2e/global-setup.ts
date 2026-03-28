import type { FullConfig } from '@playwright/test'
import {
  assertManagedStackHealthy,
  cleanupManagedFrontendServer,
  forceCleanupManagedIsolatedStack,
  prefersManagedIsolatedStack,
  recordPlaywrightRuntimeOwnership,
  runBackendReset,
  shouldSkipDbReset,
  startManagedFrontendServer,
  startManagedBackendStack,
  summarizeManagedStack,
  waitForHealthyBackendStatus,
} from './support/runtime-stack'

export default async function globalSetup(_config: FullConfig) {
  await cleanupManagedFrontendServer()

  if (prefersManagedIsolatedStack()) {
    console.log('[playwright] Cleaning up any stale isolated backend stack before reset...')
    await forceCleanupManagedIsolatedStack()
  }

  if (!shouldSkipDbReset()) {
    console.log('[playwright] Resetting backend local baseline before browser E2E...')
    runBackendReset()
  } else {
    console.log('[playwright] Skipping backend baseline reset because PLAYWRIGHT_SKIP_DB_RESET=1.')
  }

  console.log('[playwright] Starting managed backend stack for browser E2E...')

  try {
    const status = startManagedBackendStack()
    assertManagedStackHealthy(status)
    recordPlaywrightRuntimeOwnership('managed')
    console.log(
      `[playwright] Managed backend stack ready: ${JSON.stringify(summarizeManagedStack(status))}`,
    )
  } catch (error) {
    try {
      if (prefersManagedIsolatedStack()) {
        console.log(
          '[playwright] Recovering the isolated backend stack namespace before retrying startup...',
        )
        await forceCleanupManagedIsolatedStack()

        const recoveredStatus = startManagedBackendStack()
        assertManagedStackHealthy(recoveredStatus)
        recordPlaywrightRuntimeOwnership('managed')
        console.log(
          `[playwright] Managed backend stack recovered: ${JSON.stringify(
            summarizeManagedStack(recoveredStatus),
          )}`,
        )
        return
      }

      const fallbackStatus = await waitForHealthyBackendStatus()
      recordPlaywrightRuntimeOwnership('external')

      const expectedOwnershipConflict =
        error instanceof Error &&
        /unmanaged process|not tracked by the managed local stack/i.test(error.message)

      console.log(
        `[playwright] Reusing an already-running external backend stack: ${JSON.stringify(
          summarizeManagedStack(fallbackStatus),
        )}`,
      )

      if (expectedOwnershipConflict) {
        console.log(
          '[playwright] Managed stack start was skipped because API/worker ownership already belongs to an external local runtime.',
        )
      } else if (error instanceof Error) {
        console.log(
          `[playwright] Managed stack startup was bypassed after fallback validation: ${error.message}`,
        )
      }
    } catch {
      throw error
    }
  }

  console.log('[playwright] Starting managed frontend preview server for browser E2E...')
  await startManagedFrontendServer()
  console.log('[playwright] Managed frontend preview server ready.')
}
