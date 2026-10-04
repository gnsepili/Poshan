interface PersistedStore {
  persist: {
    hasHydrated: () => boolean
    onFinishHydration: (listener: () => void) => () => void
  }
}

// Resolve once every cached store has loaded from the device, so a fresh network fetch
// can never be overwritten by older cached data arriving later. zustand never reports
// hydration if storage throws, hence the timeout: a broken cache must not block startup.
export function whenHydrated(stores: PersistedStore[], timeoutMs: number): Promise<'hydrated' | 'timeout'> {
  return new Promise((resolve) => {
    const unsubscribers: (() => void)[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (result: 'hydrated' | 'timeout') => {
      if (timer) clearTimeout(timer)
      unsubscribers.forEach((u) => u())
      resolve(result)
    }
    const check = () => {
      if (stores.every((s) => s.persist.hasHydrated())) finish('hydrated')
    }
    if (stores.every((s) => s.persist.hasHydrated())) return resolve('hydrated')
    for (const s of stores) unsubscribers.push(s.persist.onFinishHydration(check))
    timer = setTimeout(() => finish('timeout'), timeoutMs)
  })
}
