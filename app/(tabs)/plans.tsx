import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Dumbbell, RefreshCw, Shuffle, SlidersHorizontal, UtensilsCrossed } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { usePlansStore } from '../../stores/plansStore'
import { useProfileStore } from '../../stores/profileStore'
import { planDays, dayMeals, dayExercises } from '../../lib/utils/plan'
import { defaultWorkoutPrefs, describeWorkoutPrefs } from '../../lib/utils/workoutPrefs'
import { MealPlanDay, WorkoutPlanDay } from '../../types'
import { Screen, Button, Heading, Text, EmptyState, Chip, IconButton, Badge } from '../../components/ui'
import { FadeIn, PressableScale } from '../../components/motion'
import { useThemeColors } from '../../lib/theme'
import { useAutoRefresh } from '../../lib/hooks/useAutoRefresh'

type Tab = 'workout' | 'meals'

// Monday = 0 … Sunday = 6, matching the plan's day order.
const todayIndex = () => (new Date().getDay() + 6) % 7

export default function PlansScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const colors = useThemeColors()
  const { profile, goals } = useProfileStore()
  const {
    mealPlan,
    workoutPlan,
    loading,
    generating,
    workoutBusy,
    error,
    fetchPlans,
    generateMealPlan,
    generateWorkoutPlan,
    regenerateWorkoutDay,
    swapWorkoutExercise,
  } = usePlansStore()
  const [tab, setTab] = useState<Tab>('workout')

  const { refreshing, onRefresh } = useAutoRefresh(() => (user ? fetchPlans(user.id) : undefined), { enabled: !!user })

  const prefs = profile?.workout_prefs ?? defaultWorkoutPrefs(goals?.goal_type)
  const mealDays = planDays<MealPlanDay>(mealPlan?.plan_json ?? null)
  const workoutDays = planDays<WorkoutPlanDay>(workoutPlan?.plan_json ?? null)
  const busy = workoutBusy !== null
  const today = todayIndex()

  return (
    <Screen title="Plans" scroll refreshing={refreshing} onRefresh={onRefresh}>
      <View className="flex-row gap-2 mb-4">
        <Chip label="Workout" icon={Dumbbell} selected={tab === 'workout'} onPress={() => setTab('workout')} />
        <Chip label="Meals" icon={UtensilsCrossed} selected={tab === 'meals'} onPress={() => setTab('meals')} />
      </View>

      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      {loading && !mealPlan && !workoutPlan ? <ActivityIndicator color={colors.primary} className="mb-4" /> : null}

      {tab === 'workout' ? (
        <View>
          <PressableScale
            className="bg-surface rounded-2xl p-4 mb-4 flex-row items-center gap-3"
            onPress={() => router.push('/plans/preferences')}
            accessibilityRole="button"
            accessibilityLabel="Edit training preferences"
          >
            <SlidersHorizontal size={20} color={colors.macroSteps} />
            <View className="flex-1">
              <Text variant="label">Your training</Text>
              <Text variant="caption" muted>{describeWorkoutPrefs(prefs)}</Text>
            </View>
            <Text variant="caption" className="text-primary font-semibold">Edit</Text>
          </PressableScale>

          {workoutDays.length === 0 ? (
            <View>
              <EmptyState icon={Dumbbell} title="No workout plan yet" description="Your coach builds a week around your goal, schedule and equipment." />
              <Button label="Build my plan" loading={workoutBusy === 'week'} disabled={busy} onPress={() => user && generateWorkoutPlan(user.id)} />
            </View>
          ) : (
            <View className="gap-3">
              {workoutDays.map((d, i) => {
                const exercises = dayExercises(d)
                const isRest = d.rest ?? exercises.length === 0
                return (
                  <FadeIn key={`${d.day}-${i}`} index={i}>
                    <View className={`rounded-3xl p-4 ${i === today ? 'bg-surface border-2 border-primary' : 'bg-surface'}`}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <Heading level={4} uppercase>{d.day}</Heading>
                          {i === today ? <Badge label="Today" tone="primary" /> : null}
                        </View>
                        {!isRest && d.duration_min ? <Text variant="caption" muted>{d.duration_min} min</Text> : null}
                      </View>
                      <Text variant="bodySm" className="font-semibold mt-0.5" style={{ color: isRest ? colors.mutedForeground : colors.macroSteps }}>
                        {d.focus}
                      </Text>

                      {isRest ? (
                        <Text variant="caption" muted className="mt-2">Recovery day — a light walk or some mobility work keeps you fresh.</Text>
                      ) : (
                        <View className="mt-2">
                          {exercises.map((ex, j) => {
                            const swapping = workoutBusy === `swap:${i}:${j}`
                            return (
                              <View key={`${ex.name}-${j}`} className={`flex-row items-center py-2 ${j < exercises.length - 1 ? 'border-b border-border' : ''}`}>
                                <View className="flex-1 pr-2">
                                  <Text variant="body">{ex.name}</Text>
                                  <Text variant="caption" muted>
                                    {ex.sets} × {ex.reps}
                                    {ex.rest_seconds ? ` · rest ${ex.rest_seconds}s` : ''}
                                  </Text>
                                  {ex.notes ? <Text variant="caption" muted>{ex.notes}</Text> : null}
                                </View>
                                {swapping ? (
                                  <ActivityIndicator color={colors.primary} style={{ width: 44 }} />
                                ) : (
                                  <IconButton icon={Shuffle} accessibilityLabel={`Swap ${ex.name}`} variant="ghost" size="sm" disabled={busy} onPress={() => swapWorkoutExercise(i, j)} />
                                )}
                              </View>
                            )
                          })}
                        </View>
                      )}

                      <Button
                        label={isRest ? 'Add a recovery session' : 'New workout for this day'}
                        variant="ghost"
                        size="sm"
                        icon={RefreshCw}
                        className="mt-2"
                        loading={workoutBusy === `day:${i}`}
                        disabled={busy}
                        onPress={() => regenerateWorkoutDay(i)}
                      />
                    </View>
                  </FadeIn>
                )
              })}
              <Button label="Rebuild whole week" variant="secondary" icon={RefreshCw} loading={workoutBusy === 'week'} disabled={busy} onPress={() => user && generateWorkoutPlan(user.id)} />
            </View>
          )}
        </View>
      ) : (
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Heading level={4} uppercase>This week&apos;s meals</Heading>
            <Button label="Regenerate" size="sm" fullWidth={false} loading={generating} onPress={() => user && generateMealPlan(user.id)} />
          </View>
          {mealDays.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="No meal plan yet" description="Tap Regenerate to have your coach build a 7-day meal plan around your targets." />
          ) : (
            <View className="gap-3">
              {mealDays.map((d, i) => (
                <FadeIn key={`${d.day}-${i}`} index={i}>
                  <View className="bg-surface rounded-3xl p-4">
                    <Heading level={4} uppercase className="mb-2">{d.day}</Heading>
                    <View className="gap-2.5">
                      {dayMeals(d).map((m, j) => (
                        <View key={j}>
                          <Text variant="caption" muted className="uppercase tracking-wide">{m.meal_type}</Text>
                          <Text variant="body">{m.description}</Text>
                          <Text variant="caption">
                            <Text variant="caption" style={{ color: colors.macroCalories }}>{m.calories} kcal</Text>
                            <Text variant="caption" muted>{`  ·  P ${m.protein_g} · C ${m.carbs_g} · F ${m.fat_g}`}</Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </FadeIn>
              ))}
            </View>
          )}
        </View>
      )}
    </Screen>
  )
}
