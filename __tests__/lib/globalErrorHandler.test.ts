jest.mock('../../lib/telemetry', () => ({ logError: jest.fn() }))

describe('installGlobalErrorHandler', () => {
  it('logs uncaught errors and still calls the previous handler, installing only once', () => {
    jest.isolateModules(() => {
      const { logError } = require('../../lib/telemetry')
      const { installGlobalErrorHandler } = require('../../lib/globalErrorHandler')
      const previous = jest.fn()
      let current: ((e: unknown, fatal?: boolean) => void) | undefined
      const setGlobalHandler = jest.fn((h) => { current = h })
      ;(globalThis as any).ErrorUtils = { getGlobalHandler: () => previous, setGlobalHandler }

      installGlobalErrorHandler()
      installGlobalErrorHandler()
      expect(setGlobalHandler).toHaveBeenCalledTimes(1)

      const err = new Error('boom')
      current!(err, true)
      expect(logError).toHaveBeenCalledWith('uncaught-fatal', err)
      expect(previous).toHaveBeenCalledWith(err, true)
      delete (globalThis as any).ErrorUtils
    })
  })
})
