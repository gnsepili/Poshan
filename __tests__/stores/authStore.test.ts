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
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
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
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn(), maybeCompleteAuthSession: jest.fn() }))
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'poshanai://auth-callback') }))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }))

import * as WebBrowser from 'expo-web-browser'

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

  it('wipes per-user stores when the session ends on its own (expiry/revocation SIGNED_OUT)', async () => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
    let listener: ((event: string, session: unknown) => void) | undefined
    ;(supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      listener = cb
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    })
    useProfileStore.setState({ profile: { id: 'u1' } as never, goals: { id: 'g1' } as never })

    await useAuthStore.getState().initialize()
    listener!('SIGNED_OUT', null)
    await new Promise((r) => setTimeout(r, 0))

    expect(useAuthStore.getState().session).toBeNull()
    expect(useProfileStore.getState().profile).toBeNull()
    expect(useProfileStore.getState().goals).toBeNull()
  })

  describe('signInWithGoogle', () => {
    beforeEach(() => {
      ;(supabase.auth.exchangeCodeForSession as jest.Mock).mockReset()
      ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({ data: { url: 'https://auth.example/authorize' }, error: null })
    })

    it('opens Google in an auth session and exchanges the returned code for a session', async () => {
      ;(WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'success', url: 'poshanai://auth-callback?code=c1' })
      const session = { user: { id: 'u1' } }
      ;(supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({ data: { session }, error: null })

      await useAuthStore.getState().signInWithGoogle()

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: 'poshanai://auth-callback', skipBrowserRedirect: true },
      })
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://auth.example/authorize', 'poshanai://auth-callback')
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('c1')
      expect(useAuthStore.getState().session).toBe(session)
      expect(useAuthStore.getState().loading).toBe(false)
      expect(useAuthStore.getState().error).toBeNull()
    })

    it('treats a dismissed browser as a quiet cancel (no error)', async () => {
      ;(WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'cancel' })
      await useAuthStore.getState().signInWithGoogle()
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
      expect(useAuthStore.getState().error).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('shows the provider error when Google sign-in fails', async () => {
      ;(WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
        type: 'success',
        url: 'poshanai://auth-callback?error=access_denied&error_description=Provider%20is%20not%20enabled',
      })
      await useAuthStore.getState().signInWithGoogle()
      expect(useAuthStore.getState().error).toBe('Provider is not enabled')
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('shows an error when the OAuth URL cannot be created', async () => {
      ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({ data: { url: null }, error: { message: 'Unsupported provider' } })
      await useAuthStore.getState().signInWithGoogle()
      expect(useAuthStore.getState().error).toBe('Unsupported provider')
    })
  })
})
