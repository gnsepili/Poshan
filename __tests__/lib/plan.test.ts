import { planDays, dayMeals, dayExercises } from '../../lib/utils/plan'
import { MealPlanDay } from '../../types'

describe('planDays', () => {
  it('returns [] for a null plan', () => {
    expect(planDays<MealPlanDay>(null)).toEqual([])
  })
  it('returns [] when days is missing', () => {
    expect(planDays<MealPlanDay>({})).toEqual([])
  })
  it('returns [] when days is not an array', () => {
    expect(planDays<MealPlanDay>({ days: 'nope' as unknown })).toEqual([])
  })
  it('returns the days array when well-formed', () => {
    const days = [{ day: 'Mon', meals: [] }]
    expect(planDays<MealPlanDay>({ days })).toEqual(days)
  })
})

describe('dayMeals', () => {
  it('returns [] for a null day', () => {
    expect(dayMeals(null)).toEqual([])
  })
  it('returns [] when meals is missing', () => {
    const day = { day: 'Mon' }
    expect(dayMeals(day)).toEqual([])
  })
  it('returns [] when meals is not an array', () => {
    const day = { day: 'Mon', meals: 'nope' as unknown }
    expect(dayMeals(day)).toEqual([])
  })
  it('returns the meals array when well-formed', () => {
    const meals = [{ meal_type: 'breakfast', description: 'Oats', calories: 300, protein_g: 10, carbs_g: 40, fat_g: 5 }]
    const day = { day: 'Mon', meals }
    expect(dayMeals(day)).toEqual(meals)
  })
})

describe('dayExercises', () => {
  it('returns [] for a null day', () => {
    expect(dayExercises(null)).toEqual([])
  })
  it('returns [] when exercises is missing', () => {
    const day = { day: 'Mon', focus: 'Legs' }
    expect(dayExercises(day)).toEqual([])
  })
  it('returns [] when exercises is not an array', () => {
    const day = { day: 'Mon', exercises: 'nope' as unknown }
    expect(dayExercises(day)).toEqual([])
  })
  it('returns the exercises array when well-formed', () => {
    const exercises = [{ name: 'Squat', sets: 3, reps: '10', notes: '' }]
    const day = { day: 'Mon', focus: 'Legs', exercises }
    expect(dayExercises(day)).toEqual(exercises)
  })
})
