import type { FullConfig } from '@playwright/test'
import {
  cleanupManagedFrontendServer,
  clearPlaywrightRuntimeOwnership,
  readPlaywrightRuntimeOwnership,
  shouldPreserveBackendStack,
  stopManagedBackendStack,
} from './support/runtime-stack'

export default async function globalTeardown(_config: FullConfig) {
  await cleanupManagedFrontendServer()

  const runtimeOwnership = readPlaywrightRuntimeOwnership()

  if (shouldPreserveBackendStack()) {
    console.log(
      '[playwright] Preserving managed backend stack because PLAYWRIGHT_PRESERVE_BACKEND_STACK=1.',
    )
    clearPlaywrightRuntimeOwnership()
    return
  }

  if (!runtimeOwnership) {
    return
  }

  if (runtimeOwnership.ownership === 'external') {
    console.log('[playwright] Leaving the pre-existing external backend stack untouched.')
    clearPlaywrightRuntimeOwnership()
    return
  }

  console.log('[playwright] Stopping managed backend stack after browser E2E...')
  const stopResult = stopManagedBackendStack()

  if (stopResult) {
    console.log(`[playwright] Managed backend stack stop result: ${JSON.stringify(stopResult)}`)
  }

  clearPlaywrightRuntimeOwnership()
}
