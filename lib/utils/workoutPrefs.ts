import { WorkoutEquipment, WorkoutExperience, WorkoutFocus, WorkoutPrefs } from '../../types'
import { GoalType } from './goalPlanner'

export const EQUIPMENT_LABEL: Record<WorkoutEquipment, string> = {
  gym: 'Gym',
  home_dumbbells: 'Dumbbells at home',
  bodyweight: 'Bodyweight only',
}

export const FOCUS_LABEL: Record<WorkoutFocus, string> = {
  fat_loss: 'Fat loss',
  muscle: 'Build muscle',
  strength: 'Strength',
  general: 'General fitness',
  endurance: 'Endurance',
}

export const EXPERIENCE_LABEL: Record<WorkoutExperience, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

// Sensible starting preferences, with the focus taken from the user's goal.
export function defaultWorkoutPrefs(goal: GoalType | null | undefined): WorkoutPrefs {
  return {
    days_per_week: 3,
    session_minutes: 45,
    equipment: 'gym',
    focus: goal === 'lose' ? 'fat_loss' : goal === 'gain' ? 'muscle' : 'general',
    experience: 'beginner',
    limitations: '',
  }
}

export function describeWorkoutPrefs(p: WorkoutPrefs): string {
  const parts = [
    `${p.days_per_week} days`,
    `${p.session_minutes} min`,
    EQUIPMENT_LABEL[p.equipment],
    FOCUS_LABEL[p.focus],
    EXPERIENCE_LABEL[p.experience],
  ]
  if (p.limitations.trim()) parts.push(`Avoid: ${p.limitations.trim()}`)
  return parts.join(' · ')
}
