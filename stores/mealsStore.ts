import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/telemetry'
import { Database } from '../lib/database.types'
import { Meal } from '../types'
import { QueuedMeal, enqueueMeal, removeMeal, updateMeal } from '../lib/utils/mealQueue'

type MealInsert = Database['public']['Tables']['meals']['Insert']

const QUEUE_KEY = 'poshan.mealQueue.v1'

async function readQueue(): Promise<QueuedMeal[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as QueuedMeal[]
  } catch {
    return []
  }
}
async function writeQueue(q: QueuedMeal[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// A queued local photo is uploaded on flush; returns the public URL or undefined.
async function uploadQueuedPhoto(item: QueuedMeal): Promise<string | undefined> {
  if (!item.photo_local_uri) return undefined
  const fileName = `${item.user_id}/${item.id}.jpg`
  const base64 = await FileSystem.readAsStringAsync(item.photo_local_uri, { encoding: FileSystem.EncodingType.Base64 })
  const { error } = await supabase.storage
    .from('meal-photos')
    .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: true })
  if (error) return undefined
  return supabase.storage.from('meal-photos').getPublicUrl(fileName).data.publicUrl
}

const isDuplicateKey = (message: string): boolean => /duplicate key|already exists/i.test(message)

interface MealsState {
  meals: Meal[]
  loading: boolean
  error: string | null
  pendingCount: number
  flushing: boolean
  fetchTodayMeals: (userId: string) => Promise<void>
  loadPendingCount: () => Promise<void>
  flushQueue: () => Promise<void>
  addMeal: (
    meal: Omit<Meal, 'id' | 'created_at' | 'logged_at' | 'ai_suggestions' | 'photo_url'> & {
      photo_url?: string
      ai_suggestions?: string | null
    }
  ) => Promise<Meal | null>
}

export const useMealsStore = create<MealsState>()(
  immer((set, get) => ({
    meals: [],
    loading: false,
    error: null,
    pendingCount: 0,
    flushing: false,

    fetchTodayMeals: async (userId) => {
      const today = new Date().toISOString().split('T')[0]
      set((s) => {
        s.loading = true
        s.error = null
      })
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .order('logged_at', { ascending: false })
      set((s) => {
        s.loading = false
        s.meals = error ? [] : (data as Meal[])
        s.error = error?.message ?? null
      })
    },

    loadPendingCount: async () => {
      const q = await readQueue()
      set((s) => {
        s.pendingCount = q.length
      })
    },

    addMeal: async (meal) => {
      set((s) => {
        s.loading = true
        s.error = null
      })
      const id = crypto.randomUUID()
      const loggedAt = new Date().toISOString()
      const payload = { id, ...meal, logged_at: loggedAt } as unknown as MealInsert
      try {
        const { data, error } = await supabase.from('meals').insert(payload).select().single()
        set((s) => {
          s.loading = false
          if (!error && data) s.meals.unshift(data as Meal)
          s.error = error?.message ?? null
        })
        if (!error && data) logEvent('meal_logged', { meal_type: meal.meal_type }, meal.user_id)
        return error ? null : (data as Meal)
      } catch (_networkErr) {
        // No connectivity: queue for flush on reconnect (photos keep their local URI).
        const queued: QueuedMeal = {
          id,
          user_id: meal.user_id,
          meal_type: meal.meal_type,
          description: meal.description,
          total_calories: meal.total_calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          fiber_g: meal.fiber_g ?? 0,
          photo_local_uri: meal.photo_url && meal.photo_url.startsWith('file:') ? meal.photo_url : undefined,
          queued_at: loggedAt,
        }
        const q = enqueueMeal(await readQueue(), queued)
        await writeQueue(q)
        set((s) => {
          s.loading = false
          s.pendingCount = q.length
          s.error = 'Saved offline — will sync when you reconnect.'
        })
        return null
      }
    },

    flushQueue: async () => {
      if (get().flushing) return // concurrency guard: never double-insert (Review Focus #3)
      set((s) => {
        s.flushing = true
      })
      let q = await readQueue()
      for (const item of q) {
        try {
          // Reuse an already-uploaded remote URL if a prior flush got this far before dying
          // (see the persist-before-insert write below) — never re-upload in that case.
          let photo_url = item.photo_url
          if (!photo_url && item.photo_local_uri) {
            const uploaded = await uploadQueuedPhoto(item)
            if (!uploaded) {
              // Photo upload failed: keep the meal queued rather than inserting it with a
              // broken/missing photo. Stop here so ordering + no-loss is preserved.
              break
            }
            photo_url = uploaded
            // Persist the uploaded URL (and drop the now-redundant local URI) BEFORE the
            // insert: if the process dies between here and the insert's removeMeal below,
            // the next flush sees photo_url already set and skips the upload entirely.
            q = updateMeal(q, item.id, { photo_url, photo_local_uri: undefined })
            await writeQueue(q)
          }
          const { error } = await supabase.from('meals').insert({
            id: item.id,
            user_id: item.user_id,
            meal_type: item.meal_type,
            description: item.description,
            total_calories: item.total_calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            fiber_g: item.fiber_g,
            photo_url: photo_url ?? null,
            logged_at: item.queued_at,
          } as unknown as MealInsert)
          // Duplicate PK => this meal was already inserted by an earlier flaky flush: done, not an error.
          if (error && !isDuplicateKey(error.message)) break // real failure: keep this + the rest, preserve order
          q = removeMeal(q, item.id)
          await writeQueue(q)
        } catch (_networkErr) {
          break // dropped mid-flush: keep remaining for next time (no data loss)
        }
      }
      set((s) => {
        s.flushing = false
        s.pendingCount = q.length
      })
    },
  }))
)
