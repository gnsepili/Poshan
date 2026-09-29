import { resetAllStores } from '../../lib/storeReset'
import { useMealsStore } from '../../stores/mealsStore'
import { useDailySummaryStore } from '../../stores/dailySummaryStore'
import { usePlansStore } from '../../stores/plansStore'
import { useProfileStore } from '../../stores/profileStore'

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
  it('clears every data store back to its empty initial state (no cross-user leak)', () => {
    useMealsStore.setState({ meals: [{ id: 'm1' } as never], pendingCount: 3 })
    useDailySummaryStore.setState({ summary: { id: 's1' } as never, recent: [{ id: 's1' } as never], loaded: true })
    usePlansStore.setState({ mealPlan: { id: 'p1' } as never })
    useProfileStore.setState({ profile: { id: 'u1' } as never, goals: { id: 'g1' } as never })

    resetAllStores()

    expect(useMealsStore.getState().meals).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
    expect(useDailySummaryStore.getState().summary).toBeNull()
    expect(useDailySummaryStore.getState().recent).toEqual([])
    expect(useDailySummaryStore.getState().loaded).toBe(false)
    expect(usePlansStore.getState().mealPlan).toBeNull()
    expect(useProfileStore.getState().profile).toBeNull()
    expect(useProfileStore.getState().goals).toBeNull()
  })
})
