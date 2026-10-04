import type { PersistOptions } from 'zustand/middleware'
import { cacheStorage } from './cacheStorage'

export const CACHE_PREFIX = 'poshan.cache.'

// The calendar day the stores query "today" by (UTC, matching their ISO date filters).
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().split('T')[0]
}

interface DayScope<S> {
  /** Field holding the day the day-scoped data was fetched for. */
  dayKey?: keyof S
  /** Fields that only make sense for that day (e.g. today's meals). */
  dayScoped?: (keyof S)[]
}

// Lay cached data over the store's initial state. Day-scoped fields cached on an earlier
// day are dropped, so the app never shows yesterday's meals as today's.
export function mergeCached<S extends object>(persisted: unknown, current: S, scope: DayScope<S>, today: string = todayKey()): S {
  if (!persisted || typeof persisted !== 'object') return current
  const cached = { ...(persisted as Partial<S>) }
  if (scope.dayKey && cached[scope.dayKey] !== (today as unknown)) {
    for (const key of scope.dayScoped ?? []) delete cached[key]
  }
  return { ...current, ...cached }
}

// Persist options for a cached store: only `keys` are written to the device, never
// loading/error flags or actions.
export function cacheOptions<S extends object>(name: string, keys: (keyof S)[], scope: DayScope<S> = {}): PersistOptions<S, Partial<S>> {
  return {
    name: `${CACHE_PREFIX}${name}`,
    version: 1,
    storage: cacheStorage as PersistOptions<S, Partial<S>>['storage'],
    partialize: (state) => Object.fromEntries(keys.map((k) => [k, state[k]])) as Partial<S>,
    merge: (persisted, current) => mergeCached(persisted, current, scope),
  }
}
