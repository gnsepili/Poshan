import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { logError } from '../telemetry'

interface Options {
  /** Skip a refresh if the last one was more recent than this (default 60s). */
  staleMs?: number
  /** Re-fetch this often while the screen is focused and the app is open (default 5 min). */
  intervalMs?: number
  /** e.g. false until there is a signed-in user. */
  enabled?: boolean
}

// Keeps a screen's (cached) data fresh: refreshes when the screen gains focus, when the app
// returns to the foreground, and on an interval while visible — each skipped if the data is
// still fresh. onRefresh is for pull-to-refresh and always fetches.
export function useAutoRefresh(
  refresh: () => Promise<unknown> | void,
  { staleMs = 60_000, intervalMs = 5 * 60_000, enabled = true }: Options = {}
): { refreshing: boolean; onRefresh: () => Promise<void> } {
  const lastRun = useRef(0)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const [refreshing, setRefreshing] = useState(false)

  const run = useCallback(
    async (force: boolean) => {
      if (!enabled) return
      if (!force && Date.now() - lastRun.current < staleMs) return
      lastRun.current = Date.now()
      try {
        await refreshRef.current()
      } catch (e) {
        logError('auto-refresh', e)
      }
    },
    [enabled, staleMs]
  )

  useFocusEffect(
    useCallback(() => {
      run(false)
      const interval = setInterval(() => {
        if (AppState.currentState !== 'background') run(false)
      }, intervalMs)
      const sub = AppState.addEventListener('change', (next) => {
        if (next === 'active') run(false)
      })
      return () => {
        clearInterval(interval)
        sub.remove()
      }
    }, [run, intervalMs])
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await run(true)
    } finally {
      setRefreshing(false)
    }
  }, [run])

  return { refreshing, onRefresh }
}
