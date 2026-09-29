/// <reference types="jest" />
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}))

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
})
