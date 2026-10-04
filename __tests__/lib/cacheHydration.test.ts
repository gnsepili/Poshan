import { whenHydrated } from '../../lib/cacheHydration'

const fakeStore = (hydrated: boolean) => {
  const listeners: (() => void)[] = []
  return {
    persist: {
      hasHydrated: jest.fn(() => hydrated),
      onFinishHydration: jest.fn((cb: () => void) => {
        listeners.push(cb)
        return () => {}
      }),
    },
    finish: () => {
      hydrated = true
      listeners.forEach((l) => l())
    },
  }
}

describe('whenHydrated', () => {
  afterEach(() => jest.useRealTimers())

  it('resolves immediately when every store is already hydrated', async () => {
    await expect(whenHydrated([fakeStore(true), fakeStore(true)], 2000)).resolves.toBe('hydrated')
  })

  it('resolves once the last store finishes hydrating', async () => {
    const a = fakeStore(true)
    const b = fakeStore(false)
    const pending = whenHydrated([a, b], 2000)
    b.finish()
    await expect(pending).resolves.toBe('hydrated')
  })

  it('gives up after the timeout so a broken cache can never block app start', async () => {
    jest.useFakeTimers()
    const pending = whenHydrated([fakeStore(false)], 2000)
    jest.advanceTimersByTime(2001)
    await expect(pending).resolves.toBe('timeout')
  })
})
