import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { buildPushTokenRow, PushTokenRow } from '../lib/utils/pushToken'
import { PushPlatform } from '../types'

interface PushState {
  token: string | null
  permissionGranted: boolean
  registering: boolean
  error: string | null
  registerForPush: (userId: string) => Promise<void>
}

export const usePushStore = create<PushState>()(
  immer((set) => ({
    token: null,
    permissionGranted: false,
    registering: false,
    error: null,

    registerForPush: async (userId) => {
      set((s) => { s.registering = true; s.error = null })
      try {
        let { status } = await Notifications.getPermissionsAsync()
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync()
          status = req.status
        }
        if (status !== 'granted') {
          set((s) => { s.registering = false; s.permissionGranted = false })
          return
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
        const tokenRes = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
        const platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android'
        const row: PushTokenRow | null = buildPushTokenRow(userId, tokenRes.data, platform)
        if (!row) {
          set((s) => { s.registering = false; s.permissionGranted = true; s.error = 'Received an invalid push token.' })
          return
        }
        // token is UNIQUE: re-registering the same device upserts in place (Review Focus #4).
        const { error } = await supabase.from('push_tokens').upsert(row, { onConflict: 'token' })
        set((s) => {
          s.registering = false
          s.permissionGranted = true
          s.token = row.token
          s.error = error?.message ?? null
        })
      } catch (e) {
        set((s) => { s.registering = false; s.error = e instanceof Error ? e.message : String(e) })
      }
    },
  }))
)
