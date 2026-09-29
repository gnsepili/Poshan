import { ActivityLog } from '../../types'

export function sumSteps(logs: ActivityLog[]): number {
  return logs.reduce((acc, l) => acc + l.steps, 0)
}

export function sumActiveCalories(logs: ActivityLog[]): number {
  return logs.reduce((acc, l) => acc + l.calories_burned, 0)
}
