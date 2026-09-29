import { resetAllStores } from '../../lib/storeReset'
import { useMealsStore, QUEUE_KEY } from '../../stores/mealsStore'
import { useDailySummaryStore } from '../../stores/dailySummaryStore'
import { usePlansStore } from '../../stores/plansStore'
import { useProfileStore } from '../../stores/profileStore'
import { useHealthConnectStore } from '../../stores/healthConnectStore'
import AsyncStorage from '@react-native-async-storage/async-storage'

// resetAllStores transitively imports every data store (unlike each store's own
// unit test, which imports only itself), so every native module those stores
// touch at import/module-init time needs a mock here too.
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), storage: { from: jest.fn() } } }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}))
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  getSdkStatus: jest.fn(),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3, SDK_UNAVAILABLE: 1 },
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
}))
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}))
jest.mock('expo-constants', () => ({ default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } } }))
jest.mock('../../lib/api/agent', () => ({ sendAgentMessage: jest.fn() }))

describe('resetAllStores', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears every data store back to its empty initial state (no cross-user leak)', async () => {
    useMealsStore.setState({ meals: [{ id: 'm1' } as never], pendingCount: 3 })
    useDailySummaryStore.setState({ summary: { id: 's1' } as never, recent: [{ id: 's1' } as never], loaded: true })
    usePlansStore.setState({ mealPlan: { id: 'p1' } as never })
    useProfileStore.setState({ profile: { id: 'u1' } as never, goals: { id: 'g1' } as never })
    useHealthConnectStore.setState({ todayHeartRate: 72 })

    await resetAllStores()

    expect(useMealsStore.getState().meals).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
    expect(useDailySummaryStore.getState().summary).toBeNull()
    expect(useDailySummaryStore.getState().recent).toEqual([])
    expect(useDailySummaryStore.getState().loaded).toBe(false)
    expect(usePlansStore.getState().mealPlan).toBeNull()
    expect(useProfileStore.getState().profile).toBeNull()
    expect(useProfileStore.getState().goals).toBeNull()
    expect(useHealthConnectStore.getState().todayHeartRate).toBeNull()
  })

  it('purges the persisted offline meal queue so a second user on a shared device never inherits it', async () => {
    await resetAllStores()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY)
  })

  it('never throws even when the queue removeItem rejects (best-effort purge)', async () => {
    ;(AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('storage exploded'))
    await expect(resetAllStores()).resolves.toBeUndefined()
  })
})
