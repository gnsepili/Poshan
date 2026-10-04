import { defaultWorkoutPrefs, describeWorkoutPrefs } from '../../lib/utils/workoutPrefs'

describe('defaultWorkoutPrefs', () => {
  it('derives the training focus from the goal', () => {
    expect(defaultWorkoutPrefs('lose').focus).toBe('fat_loss')
    expect(defaultWorkoutPrefs('gain').focus).toBe('muscle')
    expect(defaultWorkoutPrefs(null).focus).toBe('general')
    expect(defaultWorkoutPrefs('lose')).toMatchObject({ days_per_week: 3, session_minutes: 45, equipment: 'gym', experience: 'beginner', limitations: '' })
  })
})

describe('describeWorkoutPrefs', () => {
  it('summarises the preferences in one line', () => {
    expect(
      describeWorkoutPrefs({ days_per_week: 4, session_minutes: 60, equipment: 'home_dumbbells', focus: 'muscle', experience: 'intermediate', limitations: 'left knee' })
    ).toBe('4 days · 60 min · Dumbbells at home · Build muscle · Intermediate · Avoid: left knee')
  })
})
