/// <reference types="jest" />
import { useHealthConnectStore } from '../../stores/healthConnectStore'
import { supabase } from '../../lib/supabase'
import * as HC from 'react-native-health-connect'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  getSdkStatus: jest.fn(),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3, SDK_UNAVAILABLE: 1 },
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
}))

describe('healthConnectStore', () => {
  beforeEach(() => {
    useHealthConnectStore.setState({
      available: null, permissionGranted: false, todaySteps: 0, todayActiveCalories: 0, todayHeartRate: null,
      syncing: false, error: null, lastSyncedAt: null,
    })
    jest.clearAllMocks()
  })

  it('checkAvailability sets available=true when the SDK is available', async () => {
    ;(HC.getSdkStatus as jest.Mock).mockResolvedValue(3)
    await useHealthConnectStore.getState().checkAvailability()
    expect(useHealthConnectStore.getState().available).toBe(true)
  })

  it('syncNow upserts sessions with the dedup conflict target and sets today aggregates', async () => {
    ;(HC.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') return Promise.resolve({ records: [{ count: 1200 }, { count: 800 }] })
      if (type === 'ActiveCaloriesBurned') return Promise.resolve({ records: [{ energy: { inKilocalories: 150 } }] })
      if (type === 'HeartRate') return Promise.resolve({ records: [{ samples: [{ beatsPerMinute: 60 }, { beatsPerMinute: 80 }] }] })
      return Promise.resolve({
        records: [{ startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56 }],
      })
    })
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await useHealthConnectStore.getState().syncNow('u1')

    expect(supabase.from).toHaveBeenCalledWith('activity_logs')
    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      { onConflict: 'user_id,source,logged_at,activity_type', ignoreDuplicates: true }
    )
    expect(useHealthConnectStore.getState().todaySteps).toBe(2000)
    expect(useHealthConnectStore.getState().todayActiveCalories).toBe(150)
    expect(useHealthConnectStore.getState().todayHeartRate).toBe(70)
    expect(useHealthConnectStore.getState().error).toBeNull()
  })

  it('syncNow sets todayHeartRate to null when there are no heart rate samples', async () => {
    ;(HC.readRecords as jest.Mock).mockImplementation((type: string) =>
      type === 'ExerciseSession'
        ? Promise.resolve({ records: [{ startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56 }] })
        : Promise.resolve({ records: [] })
    )
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: null }) })

    await useHealthConnectStore.getState().syncNow('u1')
    expect(useHealthConnectStore.getState().todayHeartRate).toBeNull()
  })

  it('syncNow surfaces an upsert error', async () => {
    ;(HC.readRecords as jest.Mock).mockImplementation((type: string) =>
      type === 'ExerciseSession'
        ? Promise.resolve({ records: [{ startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56 }] })
        : Promise.resolve({ records: [] })
    )
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: { message: 'sync boom' } }) })

    await useHealthConnectStore.getState().syncNow('u1')
    expect(useHealthConnectStore.getState().error).toBe('sync boom')
  })
})
