import { ActivityLevel, Sex } from '../../types'

export type GoalType = 'lose' | 'maintain' | 'gain'
export type Pace = 'gentle' | 'steady' | 'fast'

export interface BodyStats {
  age: number
  sex: Sex
  height_cm: number
  current_weight_kg: number
  activity_level: ActivityLevel
}

export interface GoalChoice {
  goal: GoalType
  targetWeightKg: number
  pace: Pace
}

export interface PlannedTargets {
  maintenanceCalories: number
  calories: number
  protein: number
  carbs: number
  fat: number
  steps: number
  weeklyRateKg: number
  /** 0 for maintenance. */
  weeksToTarget: number
  /** True when the safety floor or max-deficit cap raised calories above the pace's math. */
  limitedBySafetyFloor: boolean
}

export const PACE_KG_PER_WEEK: Record<'lose' | 'gain', Record<Pace, number>> = {
  lose: { gentle: 0.25, steady: 0.5, fast: 0.75 },
  gain: { gentle: 0.1, steady: 0.25, fast: 0.4 },
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200, other: 1350 }
const KCAL_PER_KG = 7700
const MAX_DEFICIT = 0.25

const round = (n: number, step: number) => Math.round(n / step) * step

// Mifflin-St Jeor resting energy expenditure.
function bmr({ age, sex, height_cm, current_weight_kg }: BodyStats): number {
  const base = 10 * current_weight_kg + 6.25 * height_cm - 5 * age
  return base + (sex === 'male' ? 5 : sex === 'female' ? -161 : -78)
}

// Coach-style daily targets from a goal ("lose to 80 kg, steady pace") instead of asking
// users to know their own calories and macros.
export function planTargets(stats: BodyStats, choice: GoalChoice): PlannedTargets {
  const tdee = bmr(stats) * ACTIVITY_FACTOR[stats.activity_level]
  const rate = choice.goal === 'maintain' ? 0 : PACE_KG_PER_WEEK[choice.goal][choice.pace]
  const dailyDelta = (rate * KCAL_PER_KG) / 7

  let calories = tdee
  let limited = false
  if (choice.goal === 'lose') {
    // Never below the floor or a 25% deficit — but never above maintenance either (for very
    // small or older users maintenance itself can sit under the floor).
    const minimum = Math.min(tdee, Math.max(CALORIE_FLOOR[stats.sex], tdee * (1 - MAX_DEFICIT)))
    calories = tdee - dailyDelta
    if (calories < minimum) {
      calories = minimum
      limited = true
    }
  } else if (choice.goal === 'gain') {
    calories = tdee + dailyDelta
  }
  calories = round(calories, 10)

  const proteinPerKg = choice.goal === 'lose' ? 2.0 : choice.goal === 'gain' ? 1.8 : 1.6
  // When losing, size protein to the target weight (a lean-mass proxy), not current weight.
  const proteinBasis = choice.goal === 'lose' ? Math.min(stats.current_weight_kg, choice.targetWeightKg) : stats.current_weight_kg
  const protein = round(proteinPerKg * proteinBasis, 5)
  const fat = round((calories * 0.25) / 9, 5)
  const carbs = Math.max(50, round((calories - protein * 4 - fat * 9) / 4, 5))

  const gap = Math.abs(stats.current_weight_kg - choice.targetWeightKg)
  return {
    maintenanceCalories: round(tdee, 10),
    calories,
    protein,
    carbs,
    fat,
    steps: choice.goal === 'lose' ? 10000 : choice.goal === 'gain' ? 7000 : 8000,
    weeklyRateKg: rate,
    weeksToTarget: rate > 0 ? Math.ceil(gap / rate) : 0,
    limitedBySafetyFloor: limited,
  }
}

// Starting suggestion for the target-weight field.
export function suggestedTargetWeight(stats: BodyStats, goal: GoalType): number {
  const w = stats.current_weight_kg
  if (goal === 'maintain') return Math.round(w)
  if (goal === 'gain') return Math.round(w + 3)
  const healthyMax = 24.9 * Math.pow(stats.height_cm / 100, 2)
  return Math.round(Math.min(w - 1, Math.max(healthyMax, w * 0.9)))
}

// A target weight that contradicts the goal (e.g. "lose" to a heavier weight), or null.
export function goalDirectionError(goal: GoalType, currentKg: number, targetKg: number): string | null {
  if (goal === 'lose' && targetKg >= currentKg) return `To lose fat, set a target below your current ${currentKg} kg.`
  if (goal === 'gain' && targetKg <= currentKg) return `To build muscle, set a target above your current ${currentKg} kg.`
  return null
}
