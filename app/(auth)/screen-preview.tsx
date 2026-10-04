import { useEffect, useState } from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useProfileStore } from '../../stores/profileStore'
import { usePlansStore } from '../../stores/plansStore'
import { useChatStore } from '../../stores/chatStore'
import PlansScreen from '../(tabs)/plans'
import GoalsScreen from '../(onboarding)/goals'
import ThreadsScreen from '../coach/threads'
import { Profile, WorkoutPlan } from '../../types'

// Development-only: renders a real screen with sample store data so it can be checked on
// web without signing in. /screen-preview?screen=plans|goals|threads. Release builds redirect.
const profile = {
  id: 'preview',
  age: 28,
  sex: 'male',
  height_cm: 175,
  current_weight_kg: 94.2,
  activity_level: 'moderate',
  workout_prefs: { days_per_week: 4, session_minutes: 45, equipment: 'gym', focus: 'fat_loss', experience: 'beginner', limitations: 'left knee' },
} as unknown as Profile

const ex = (name: string, sets: number, reps: string, rest: number, notes = '') => ({ name, sets, reps, rest_seconds: rest, notes })
const workoutPlan = {
  id: 'w-preview',
  user_id: 'preview',
  week_start_date: '2026-10-05',
  created_at: '2026-10-04',
  plan_json: {
    days: [
      { day: 'Monday', rest: false, focus: 'Upper body push', duration_min: 45, exercises: [ex('Barbell bench press', 4, '6-8', 120, 'Warm up with 2 light sets'), ex('Seated dumbbell press', 3, '8-10', 90), ex('Cable triceps pushdown', 3, '12', 60)] },
      { day: 'Tuesday', rest: false, focus: 'Lower body (knee-friendly)', duration_min: 45, exercises: [ex('Romanian deadlift', 4, '8', 120), ex('Hip thrust', 3, '10', 90)] },
      { day: 'Wednesday', rest: true, focus: 'Rest / light walk', duration_min: 0, exercises: [] },
      { day: 'Thursday', rest: false, focus: 'Upper body pull', duration_min: 45, exercises: [ex('Lat pulldown', 4, '8-10', 90), ex('Single-arm dumbbell row', 3, '10 each side', 60)] },
    ],
  },
} as unknown as WorkoutPlan

export default function ScreenPreview() {
  const { screen } = useLocalSearchParams<{ screen?: string }>()
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (!__DEV__) return
    useProfileStore.setState({ profile, goals: null })
    usePlansStore.setState({ workoutPlan, mealPlan: null, workoutBusy: 'swap:0:1', error: null })
    useChatStore.setState({
      conversationId: 'c1',
      conversations: [
        { id: 'c1', title: 'How much protein should I eat on rest days?', updated_at: new Date().toISOString() },
        { id: 'c2', title: 'Swap ideas for my dinner', updated_at: new Date(Date.now() - 3 * 86400000).toISOString() },
      ],
    })
    setSeeded(true)
  }, [])
  if (!__DEV__) return <Redirect href="/(auth)/login" />
  if (!seeded) return null
  if (screen === 'goals') return <GoalsScreen />
  if (screen === 'threads') return <ThreadsScreen />
  return <PlansScreen />
}
