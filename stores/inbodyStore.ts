import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { InBodyReport } from '../types'

type InBodyInsert = Database['public']['Tables']['inbody_reports']['Insert']

export interface NewInBodyReport {
  user_id: string
  photo_url: string // storage PATH in inbody-photos
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  raw_extracted_json: Record<string, unknown> | null
  ai_notes: string | null
}

interface InbodyState {
  reports: InBodyReport[]
  latest: InBodyReport | null
  loading: boolean
  error: string | null
  fetchReports: (userId: string) => Promise<void>
  addReport: (report: NewInBodyReport) => Promise<InBodyReport | null>
}

export const useInbodyStore = create<InbodyState>()(
  immer((set) => ({
    reports: [],
    latest: null,
    loading: false,
    error: null,

    fetchReports: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('inbody_reports')
        .select('*')
        .eq('user_id', userId)
        .order('scanned_at', { ascending: false })
      set((s) => {
        s.loading = false
        const rows = error ? [] : (data as InBodyReport[])
        s.reports = rows
        s.latest = rows[0] ?? null
        s.error = error?.message ?? null
      })
    },

    addReport: async (report) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('inbody_reports')
        .insert(report as unknown as InBodyInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) {
          s.reports.unshift(data as InBodyReport)
          s.latest = data as InBodyReport
        }
        s.error = error?.message ?? null
      })
      return error ? null : (data as InBodyReport)
    },
  }))
)
