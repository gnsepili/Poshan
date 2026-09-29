/// <reference types="jest" />
import { usePushStore } from '../../stores/pushStore'
import { supabase } from '../../lib/supabase'
import * as Notifications from 'expo-notifications'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}))
jest.mock('expo-constants', () => ({ default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } } }))

describe('pushStore', () => {
  beforeEach(() => {
    usePushStore.setState({ token: null, permissionGranted: false, registering: false, error: null })
    jest.clearAllMocks()
  })

  it('registers and upserts the token on the unique token conflict target', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[abc]' })
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await usePushStore.getState().registerForPush('u1')

    expect(supabase.from).toHaveBeenCalledWith('push_tokens')
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', token: 'ExponentPushToken[abc]', platform: expect.any(String) },
      { onConflict: 'token' }
    )
    expect(usePushStore.getState().token).toBe('ExponentPushToken[abc]')
    expect(usePushStore.getState().error).toBeNull()
  })

  it('does nothing and records an error when permission is denied', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' })
    const upsert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await usePushStore.getState().registerForPush('u1')

    expect(upsert).not.toHaveBeenCalled()
    expect(usePushStore.getState().permissionGranted).toBe(false)
  })

  it('does not upsert a garbage token', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'garbage' })
    const upsert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await usePushStore.getState().registerForPush('u1')
    expect(upsert).not.toHaveBeenCalled()
  })
})
