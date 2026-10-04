import { InBodyAnalysisResult } from '../api/inbody'

// Columns written for a v2 (full-sheet) extraction. The five headline values come from
// the review form (the user may correct them); everything else comes from the analysis.
export function reportColumnsFromAnalysis(
  analysis: InBodyAnalysisResult,
  headline: { weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null; visceral_fat: number | null; bmr: number | null }
) {
  return {
    ...headline,
    bmi: analysis.bmi,
    body_fat_mass_kg: analysis.body_fat_mass_kg,
    fat_free_mass_kg: analysis.fat_free_mass_kg,
    total_body_water_l: analysis.total_body_water_l,
    ecw_tbw_ratio: analysis.ecw_tbw_ratio,
    inbody_score: analysis.inbody_score,
    smi: analysis.smi,
    phase_angle: analysis.phase_angle,
    waist_hip_ratio: analysis.waist_hip_ratio,
    target_weight_kg: analysis.target_weight_kg,
    raw_extracted_json: analysis.details as unknown as Record<string, unknown>,
    ai_notes: analysis.notes || null,
    extraction_version: 2,
    // The printed test date beats "now" — scans are often uploaded days later.
    ...(analysis.scan_date ? { scanned_at: `${analysis.scan_date}T12:00:00Z` } : {}),
  }
}
