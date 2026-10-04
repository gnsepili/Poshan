import { reportColumnsFromAnalysis } from '../../lib/utils/inbodyReport'
import { InBodyAnalysisResult } from '../../lib/api/inbody'

const analysis = {
  bmi: 31.2, body_fat_mass_kg: 30.3, fat_free_mass_kg: 63.9, total_body_water_l: 46.9, ecw_tbw_ratio: 0.385,
  inbody_score: 64, smi: 8.9, phase_angle: 5.6, waist_hip_ratio: 0.98, target_weight_kg: 75.2,
  scan_date: '2026-10-03', details: { core: {} }, notes: 'Nice work',
} as unknown as InBodyAnalysisResult

const headline = { weight_kg: 94.2, body_fat_pct: 32.1, muscle_mass_kg: 36.1, visceral_fat: 14, bmr: 1751 }

describe('reportColumnsFromAnalysis', () => {
  it('maps a full analysis to v2 columns, keeping the (user-reviewed) headline values', () => {
    const cols = reportColumnsFromAnalysis(analysis, { ...headline, weight_kg: 94.0 })
    expect(cols).toMatchObject({
      weight_kg: 94.0, bmi: 31.2, ecw_tbw_ratio: 0.385, inbody_score: 64, target_weight_kg: 75.2,
      raw_extracted_json: { core: {} }, ai_notes: 'Nice work', extraction_version: 2,
      scanned_at: '2026-10-03T12:00:00Z',
    })
  })

  it('leaves scanned_at unset when the sheet date was unreadable', () => {
    const cols = reportColumnsFromAnalysis({ ...analysis, scan_date: null }, headline)
    expect('scanned_at' in cols).toBe(false)
  })
})
