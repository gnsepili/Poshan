import { logError } from './telemetry'

type GlobalHandler = (error: unknown, isFatal?: boolean) => void
interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler
  setGlobalHandler(handler: GlobalHandler): void
}

let installed = false

// Report uncaught JS errors (outside React render, e.g. in event handlers and timers)
// to error_logs, then hand off to React Native's default handler (red box / crash).
export function installGlobalErrorHandler(): void {
  if (installed) return
  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
  if (!errorUtils) return
  installed = true
  const previous = errorUtils.getGlobalHandler()
  errorUtils.setGlobalHandler((error, isFatal) => {
    logError(isFatal ? 'uncaught-fatal' : 'uncaught', error)
    previous(error, isFatal)
  })
}
