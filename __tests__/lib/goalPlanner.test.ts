import { planTargets, PACE_KG_PER_WEEK, suggestedTargetWeight } from '../../lib/utils/goalPlanner'

const ganesh = { age: 28, sex: 'male' as const, height_cm: 175, current_weight_kg: 94.2, activity_level: 'moderate' as const }

describe('planTargets', () => {
  it('computes a moderate deficit for steady fat loss (Mifflin-St Jeor x activity)', () => {
    // BMR = 10*94.2 + 6.25*175 - 5*28 + 5 = 1900.75; TDEE = 1900.75 * 1.55 = 2946
    const p = planTargets(ganesh, { goal: 'lose', targetWeightKg: 80, pace: 'steady' })
    expect(p.maintenanceCalories).toBe(2950)
    expect(p.calories).toBe(2400) // 2946 - 0.5*7700/7 = 2396 -> nearest 10
    expect(p.protein).toBe(160) // 2.0 g/kg of the 80 kg target
    expect(p.fat).toBe(65) // ~25% of calories
    expect(p.carbs).toBe(p.carbs) // remainder, checked below
    expect(p.protein * 4 + p.carbs * 4 + p.fat * 9).toBeGreaterThan(p.calories - 40)
    expect(p.protein * 4 + p.carbs * 4 + p.fat * 9).toBeLessThan(p.calories + 40)
    expect(p.steps).toBe(10000)
    expect(p.weeksToTarget).toBe(29) // 14.2 kg / 0.5 per week, rounded up
    expect(p.limitedBySafetyFloor).toBe(false)
  })

  it('never goes below the safety floor or a 25% deficit, and says so', () => {
    const small = { age: 40, sex: 'female' as const, height_cm: 155, current_weight_kg: 58, activity_level: 'sedentary' as const }
    const p = planTargets(small, { goal: 'lose', targetWeightKg: 50, pace: 'fast' })
    expect(p.calories).toBeGreaterThanOrEqual(1200)
    expect(p.calories).toBeGreaterThanOrEqual(Math.round(p.maintenanceCalories * 0.75 / 10) * 10 - 10)
    expect(p.limitedBySafetyFloor).toBe(true)
  })

  it('adds a surplus for muscle gain and holds calories for maintenance', () => {
    const gain = planTargets(ganesh, { goal: 'gain', targetWeightKg: 97, pace: 'steady' })
    expect(gain.calories).toBeGreaterThan(gain.maintenanceCalories)
    expect(gain.protein).toBe(170) // 1.8 g/kg of current weight, nearest 5
    const keep = planTargets(ganesh, { goal: 'maintain', targetWeightKg: 94.2, pace: 'steady' })
    expect(keep.calories).toBe(keep.maintenanceCalories)
    expect(keep.weeksToTarget).toBe(0)
  })

  it('exposes the pace table used in the UI', () => {
    expect(PACE_KG_PER_WEEK.lose.steady).toBe(0.5)
    expect(PACE_KG_PER_WEEK.gain.steady).toBe(0.25)
  })
})

describe('suggestedTargetWeight', () => {
  it('suggests a sensible starting target per goal', () => {
    expect(suggestedTargetWeight(ganesh, 'lose')).toBeLessThan(94.2)
    expect(suggestedTargetWeight(ganesh, 'gain')).toBeGreaterThan(94.2)
    expect(suggestedTargetWeight(ganesh, 'maintain')).toBe(94)
  })
})
