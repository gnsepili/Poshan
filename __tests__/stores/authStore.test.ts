/// <reference types="jest" />
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { useProfileStore } from '../../stores/profileStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QUEUE_KEY } from '../../stores/mealsStore'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}))
// signOut dynamically imports lib/storeReset, which transitively imports every
// data store; those stores' native module imports need the same mocks their own
// unit tests use, or import-time execution throws (see e.g. mealsStore.test.ts).
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

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ session: null, user: null, loading: false, error: null }))

  it('sets error on failed sign in', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid credentials' },
    })
    await useAuthStore.getState().signIn('a@b.com', 'wrong')
    expect(useAuthStore.getState().error).toBe('Invalid credentials')
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('sets session on successful sign in', async () => {
    const mockSession = { user: { id: 'user-1', email: 'a@b.com' } }
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    await useAuthStore.getState().signIn('a@b.com', 'password')
    expect(useAuthStore.getState().session).toEqual(mockSession)
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('sets error on failed sign out', async () => {
    ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({
      error: { message: 'Network error' },
    })
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState().error).toBe('Network error')
    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('clears error on successful sign out', async () => {
    useAuthStore.setState({ error: 'stale error' })
    ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState().error).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('wipes other users data stores on sign out (Review Focus #5: no cross-user leak)', async () => {
    // Populate a data store the way it would look mid-session for user A.
    useProfileStore.setState({ profile: { id: 'user-a' } as never, goals: { id: 'goal-a' } as never })
    ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })

    await useAuthStore.getState().signOut()

    expect(useProfileStore.getState().profile).toBeNull()
    expect(useProfileStore.getState().goals).toBeNull()
  })

  it('purges the offline meal queue on sign out (shared-device: user B must not inherit user A\'s queue)', async () => {
    ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })
    await useAuthStore.getState().signOut()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(QUEUE_KEY)
  })

  it('sets error when session restore fails on initialize', async () => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: 'Session expired' },
    })
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().error).toBe('Session expired')
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('clears error on successful initialize', async () => {
    useAuthStore.setState({ error: 'stale error' })
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().error).toBeNull()
  })
})
