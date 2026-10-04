import { act, renderHook } from '@testing-library/react-native'
import { useAutoRefresh } from '../../lib/hooks/useAutoRefresh'

// Treat the screen as focused for as long as the hook is mounted.
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect: mockUseEffect } = require('react')
    mockUseEffect(effect, [effect])
  },
}))
jest.mock('../../lib/telemetry', () => ({ logError: jest.fn() }))

describe('useAutoRefresh', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('refreshes when the screen gains focus', () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    renderHook(() => useAutoRefresh(refresh))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh while disabled (e.g. no signed-in user yet), then does once enabled', () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ enabled }: { enabled: boolean }) => useAutoRefresh(refresh, { enabled }), { initialProps: { enabled: false } })
    expect(refresh).not.toHaveBeenCalled()
    rerender({ enabled: true })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes again on the interval while focused', () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    renderHook(() => useAutoRefresh(refresh, { staleMs: 1000, intervalMs: 5000 }))
    act(() => {
      jest.advanceTimersByTime(5001)
    })
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('pull-to-refresh forces a refresh even when data is fresh, and reports refreshing', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoRefresh(refresh, { staleMs: 60_000 }))
    await act(async () => {
      await result.current.onRefresh()
    })
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(result.current.refreshing).toBe(false)
  })

  it('never throws when a refresh fails', async () => {
    const refresh = jest.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useAutoRefresh(refresh))
    await act(async () => {
      await result.current.onRefresh()
    })
    expect(result.current.refreshing).toBe(false)
  })
})
