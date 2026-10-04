import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { InBodyReport } from '../types'

type InBodyInsert = Database['public']['Tables']['inbody_reports']['Insert']

type InBodyUpdate = Database['public']['Tables']['inbody_reports']['Update']

// Typed metric columns other than the headline five; all optional (legacy saves omit them).
type ExtraMetrics = Partial<
  Pick<
    InBodyReport,
    | 'bmi' | 'body_fat_mass_kg' | 'fat_free_mass_kg' | 'total_body_water_l' | 'ecw_tbw_ratio' | 'inbody_score'
    | 'smi' | 'phase_angle' | 'waist_hip_ratio' | 'target_weight_kg' | 'extraction_version' | 'scanned_at'
  >
>

export interface NewInBodyReport extends ExtraMetrics {
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

export type InBodyReportPatch = Omit<Partial<NewInBodyReport>, 'user_id' | 'photo_url'>

interface InbodyState {
  reports: InBodyReport[]
  latest: InBodyReport | null
  loading: boolean
  error: string | null
  fetchReports: (userId: string) => Promise<void>
  addReport: (report: NewInBodyReport) => Promise<InBodyReport | null>
  /** Overwrite a report's extracted values, e.g. after re-reading an old scan in full. */
  updateReport: (id: string, patch: InBodyReportPatch) => Promise<InBodyReport | null>
}

export const useInbodyStore = create<InbodyState>()(
  persist(
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
        // On failure keep what's cached rather than blanking the screen.
        if (!error) {
          const rows = data as InBodyReport[]
          s.reports = rows
          s.latest = rows[0] ?? null
        }
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
          // A printed test date can be older than existing scans, so keep newest-first order.
          s.reports = [data as InBodyReport, ...s.reports].sort((a, b) => b.scanned_at.localeCompare(a.scanned_at))
          s.latest = s.reports[0] ?? null
        }
        s.error = error?.message ?? null
      })
      return error ? null : (data as InBodyReport)
    },

    updateReport: async (id, patch) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('inbody_reports')
        .update(patch as unknown as InBodyUpdate)
        .eq('id', id)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) {
          const updated = data as InBodyReport
          s.reports = s.reports
            .map((r) => (r.id === id ? updated : r))
            .sort((a, b) => b.scanned_at.localeCompare(a.scanned_at))
          s.latest = s.reports[0] ?? null
        }
        s.error = error?.message ?? null
      })
      return error ? null : (data as InBodyReport)
    },
  })),
  cacheOptions<InbodyState>('inbody', ['reports', 'latest'])
  )
)
