import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  readRecords,
  Permission,
} from 'react-native-health-connect'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/telemetry'
import { Database } from '../lib/database.types'
import {
  sessionsToActivityRows,
  sumStepsRecords,
  sumActiveCaloriesRecords,
  HcExerciseSession,
} from '../lib/utils/healthConnect'

type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert']

// Read-only Health Connect permissions the spec requires.
const HC_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'ExerciseSession' },
]

interface HealthConnectState {
  available: boolean | null
  permissionGranted: boolean
  todaySteps: number
  todayActiveCalories: number
  syncing: boolean
  error: string | null
  lastSyncedAt: string | null
  checkAvailability: () => Promise<void>
  requestPermissions: () => Promise<void>
  syncNow: (userId: string) => Promise<void>
}

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() } as const
}

export const useHealthConnectStore = create<HealthConnectState>()(
  immer((set) => ({
    available: null,
    permissionGranted: false,
    todaySteps: 0,
    todayActiveCalories: 0,
    syncing: false,
    error: null,
    lastSyncedAt: null,

    checkAvailability: async () => {
      try {
        const status = await getSdkStatus()
        set((s) => { s.available = status === SdkAvailabilityStatus.SDK_AVAILABLE })
      } catch {
        // iOS / no Health Connect: not available, fall back to manual logging.
        set((s) => { s.available = false })
      }
    },

    requestPermissions: async () => {
      set((s) => { s.error = null })
      try {
        const ok = await initialize()
        if (!ok) {
          set((s) => { s.available = false; s.error = 'Health Connect is not available on this device.' })
          return
        }
        const granted = await requestPermission(HC_PERMISSIONS)
        set((s) => { s.permissionGranted = Array.isArray(granted) && granted.length > 0 })
      } catch (e) {
        set((s) => { s.error = e instanceof Error ? e.message : String(e) })
      }
    },

    syncNow: async (userId) => {
      set((s) => { s.syncing = true; s.error = null })
      try {
        const range = todayRange()
        const [stepsRes, calRes, sessionRes] = await Promise.all([
          readRecords('Steps', { timeRangeFilter: range }),
          readRecords('ActiveCaloriesBurned', { timeRangeFilter: range }),
          readRecords('ExerciseSession', { timeRangeFilter: range }),
        ])
        const steps = sumStepsRecords((stepsRes.records ?? []) as { count: number }[])
        const activeCalories = sumActiveCaloriesRecords((calRes.records ?? []) as { energy: { inKilocalories: number } }[])
        const rows = sessionsToActivityRows(userId, (sessionRes.records ?? []) as HcExerciseSession[])

        let error: string | null = null
        if (rows.length > 0) {
          // Idempotent: the dedup unique index collapses a re-synced session (Review Focus #1).
          const { error: upsertError } = await supabase
            .from('activity_logs')
            .upsert(rows as unknown as ActivityLogInsert[], { onConflict: 'user_id,source,logged_at,activity_type', ignoreDuplicates: true })
          error = upsertError?.message ?? null
        }

        set((s) => {
          s.syncing = false
          s.todaySteps = steps
          s.todayActiveCalories = activeCalories
          s.lastSyncedAt = new Date().toISOString()
          s.error = error
        })
        logEvent('hc_synced', { steps, sessions: rows.length }, userId)
      } catch (e) {
        set((s) => { s.syncing = false; s.error = e instanceof Error ? e.message : String(e) })
      }
    },
  }))
)
