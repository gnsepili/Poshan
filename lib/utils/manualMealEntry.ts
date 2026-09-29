export interface ManualMacroInput {
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber?: string
}

export interface ManualMacros {
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

// A required numeric field: trimmed, must parse to a finite non-negative number.
function parseRequired(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

// Validate a manual macro entry (used by the offline "log meal without a photo/AI analysis"
// path) so a malformed or missing value can never silently become a bogus meal — required
// fields (calories/protein/carbs/fat) must all be present, numeric, and non-negative; fiber
// is optional and defaults to 0 when blank/omitted, but if provided it's validated the same way.
export function parseManualMacros(input: ManualMacroInput): ManualMacros | null {
  const total_calories = parseRequired(input.calories)
  const protein_g = parseRequired(input.protein)
  const carbs_g = parseRequired(input.carbs)
  const fat_g = parseRequired(input.fat)
  if (total_calories === null || protein_g === null || carbs_g === null || fat_g === null) return null

  let fiber_g = 0
  if (input.fiber !== undefined && input.fiber.trim() !== '') {
    const parsedFiber = parseRequired(input.fiber)
    if (parsedFiber === null) return null
    fiber_g = parsedFiber
  }

  return { total_calories, protein_g, carbs_g, fat_g, fiber_g }
}
