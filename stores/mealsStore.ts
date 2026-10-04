import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/telemetry'
import { Database } from '../lib/database.types'
import { Meal } from '../types'
import { QueuedMeal, enqueueMeal, removeMeal, updateMeal } from '../lib/utils/mealQueue'

type MealInsert = Database['public']['Tables']['meals']['Insert']

export const QUEUE_KEY = 'poshan.mealQueue.v1'

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

// A queued local photo is uploaded on flush; returns its storage path (the bucket is
// private — photos are shown via signed URLs) or undefined if the upload failed.
async function uploadQueuedPhoto(item: QueuedMeal): Promise<string | undefined> {
  if (!item.photo_local_uri) return undefined
  const fileName = `${item.user_id}/${item.id}.jpg`
  const base64 = await FileSystem.readAsStringAsync(item.photo_local_uri, { encoding: FileSystem.EncodingType.Base64 })
  const { error } = await supabase.storage
    .from('meal-photos')
    .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: true })
  if (error) return undefined
  return fileName
}

const isDuplicateKey = (message: string): boolean => /duplicate key|already exists/i.test(message)

// What happened to a meal the user tried to log — the screen keeps its form open on 'failed'.
export type AddMealResult = { status: 'saved'; meal: Meal } | { status: 'queued' } | { status: 'failed'; error: string }

interface MealsState {
  meals: Meal[]
  /** The day `meals` was fetched for (drops stale cached data after midnight). */
  mealsDay: string | null
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
  ) => Promise<AddMealResult>
}

export const useMealsStore = create<MealsState>()(
  persist(
  immer((set, get) => ({
    meals: [],
    mealsDay: null,
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
        // On failure keep what's cached rather than blanking the screen.
        if (!error) {
          s.meals = data as Meal[]
          s.mealsDay = today
        }
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
      const id = randomUUID()
      const loggedAt = new Date().toISOString()
      const payload = { id, ...meal, logged_at: loggedAt } as unknown as MealInsert

      // postgrest-js resolves (never rejects) on a dropped connection, reporting status 0;
      // the catch only guards against a client that does throw.
      let offline = false
      try {
        const { data, error, status } = await supabase.from('meals').insert(payload).select().single()
        if (!error && data) {
          set((s) => {
            s.loading = false
            s.meals.unshift(data as Meal)
          })
          logEvent('meal_logged', { meal_type: meal.meal_type }, meal.user_id)
          return { status: 'saved', meal: data as Meal }
        }
        if (status !== 0) {
          const message = error?.message ?? 'Could not save the meal.'
          set((s) => {
            s.loading = false
            s.error = message
          })
          return { status: 'failed', error: message }
        }
        offline = true
      } catch (_networkErr) {
        offline = true
      }

      // No connectivity: queue for flush on reconnect (photos keep their local URI).
      if (offline) {
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
          // A local photo is uploaded on flush; an already-uploaded one is kept as-is.
          photo_local_uri: meal.photo_url?.startsWith('file:') ? meal.photo_url : undefined,
          photo_url: meal.photo_url && !meal.photo_url.startsWith('file:') ? meal.photo_url : undefined,
          ai_suggestions: meal.ai_suggestions ?? null,
          queued_at: loggedAt,
        }
        try {
          const q = enqueueMeal(await readQueue(), queued)
          await writeQueue(q)
          set((s) => {
            s.loading = false
            s.pendingCount = q.length // the screen's pending banner is the user-facing signal
          })
          return { status: 'queued' }
        } catch (_storageErr) {
          // fall through: neither saved nor queued
        }
      }
      const message = "You're offline and the meal couldn't be saved on this device. Please try again."
      set((s) => {
        s.loading = false
        s.error = message
      })
      return { status: 'failed', error: message }
    },

    flushQueue: async () => {
      if (get().flushing) return // concurrency guard: never double-insert (Review Focus #3)
      set((s) => {
        s.flushing = true
      })
      // Everything below — including the initial read — runs inside try/finally so a
      // rejecting AsyncStorage call (or any other unexpected throw) can never leave
      // `flushing` stuck at true (that would permanently disable offline sync until
      // the app restarts).
      let q: QueuedMeal[] = []
      try {
        q = await readQueue()
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
              ai_suggestions: item.ai_suggestions ?? null,
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
      } finally {
        // ALWAYS runs — even if readQueue() itself rejected — so `flushing` can never get
        // stuck at true (which would silently disable offline sync until app restart).
        set((s) => {
          s.flushing = false
          s.pendingCount = q.length
        })
      }
    },
  })),
  cacheOptions<MealsState>('meals', ['meals', 'mealsDay'], { dayKey: 'mealsDay', dayScoped: ['meals'] })
  )
)
