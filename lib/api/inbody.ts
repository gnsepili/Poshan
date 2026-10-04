import { invokeEdgeFunction } from './edgeFunction'
import { InBodyDetails } from '../../types'

export interface InBodyAnalysisResult {
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  bmi: number | null
  body_fat_mass_kg: number | null
  fat_free_mass_kg: number | null
  total_body_water_l: number | null
  ecw_tbw_ratio: number | null
  inbody_score: number | null
  smi: number | null
  phase_angle: number | null
  waist_hip_ratio: number | null
  target_weight_kg: number | null
  /** Test date printed on the sheet (YYYY-MM-DD), when readable. */
  scan_date: string | null
  details: InBodyDetails
  raw: Record<string, unknown>
  notes: string
}

// Reading a dense sheet at high detail can take a while.
export function analyzeInBodyPhoto(photoPath: string): Promise<InBodyAnalysisResult> {
  return invokeEdgeFunction<InBodyAnalysisResult>('ai-inbody-analysis', { photo_url: photoPath }, { timeoutMs: 90_000 })
}
