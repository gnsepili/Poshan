import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/telemetry'
import { ArcRow } from '../lib/challenge/progress'

export interface Challenge {
  id: string
  user_id: string
  kind: string
  title: string
  start_date: string
  end_date: string
  rules: string[]
  strict: boolean
  status: 'active' | 'completed' | 'abandoned'
  start_weight_kg: number | null
  start_body_fat_pct: number | null
  created_at: string
}

export interface JoinArcInput {
  userId: string
  title: string
  startDate: string
  endDate: string
  rules: string[]
  strict: boolean
  startWeightKg: number | null
  startBodyFatPct: number | null
}

interface ChallengeState {
  challenge: Challenge | null
  rows: ArcRow[]
  loading: boolean
  error: string | null
  fetchActive: (userId: string) => Promise<void>
  refreshProgress: () => Promise<void>
  join: (input: JoinArcInput) => Promise<boolean>
  /** Tick or untick a manual rule for a day (optimistic; rolls back on failure). */
  toggleRule: (ruleId: string, date: string, done: boolean) => Promise<void>
  leave: () => Promise<void>
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export const useChallengeStore = create<ChallengeState>()(
  persist(
  immer((set, get) => ({
    challenge: null,
    rows: [],
    loading: false,
    error: null,

    refreshProgress: async () => {
      const challenge = get().challenge
      if (!challenge) return
      const { data, error } = await supabase.rpc('challenge_progress', { p_challenge_id: challenge.id })
      set((s) => {
        if (error) s.error = error.message
        else
          s.rows = ((data ?? []) as { day: string; rule_id: string; done: boolean; value: unknown; target: unknown }[]).map((r) => ({
            day: r.day,
            rule_id: r.rule_id,
            done: r.done,
            value: num(r.value),
            target: num(r.target),
          }))
      })
    },

    fetchActive: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      set((s) => {
        s.loading = false
        if (error) s.error = error.message
        else {
          s.challenge = (data as Challenge | null) ?? null
          if (!data) s.rows = []
        }
      })
      if (!error && data) await get().refreshProgress()
    },

    join: async (input) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('challenges')
        .insert({
          user_id: input.userId,
          kind: 'winter_arc',
          title: input.title,
          start_date: input.startDate,
          end_date: input.endDate,
          rules: input.rules,
          strict: input.strict,
          start_weight_kg: input.startWeightKg,
          start_body_fat_pct: input.startBodyFatPct,
        })
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (error) s.error = error.message
        else {
          s.challenge = data as Challenge
          s.rows = []
        }
      })
      if (error) return false
      logEvent('challenge_joined', { rules: input.rules.length, strict: input.strict }, input.userId)
      await get().refreshProgress()
      return true
    },

    toggleRule: async (ruleId, date, done) => {
      const challenge = get().challenge
      if (!challenge) return
      const setDone = (value: boolean) =>
        set((s) => {
          const row = s.rows.find((r) => r.day === date && r.rule_id === ruleId)
          if (row) row.done = value
          else s.rows.push({ day: date, rule_id: ruleId, done: value, value: null, target: null })
        })
      setDone(done)
      const { error } = await supabase
        .from('challenge_checkins')
        .upsert({ challenge_id: challenge.id, user_id: challenge.user_id, date, rule_id: ruleId, done })
      if (error) {
        setDone(!done)
        set((s) => { s.error = error.message })
      }
    },

    leave: async () => {
      const challenge = get().challenge
      if (!challenge) return
      const { error } = await supabase.from('challenges').update({ status: 'abandoned' }).eq('id', challenge.id)
      set((s) => {
        if (error) s.error = error.message
        else {
          s.challenge = null
          s.rows = []
        }
      })
    },
  })),
  cacheOptions<ChallengeState>('challenge', ['challenge', 'rows'])
  )
)
