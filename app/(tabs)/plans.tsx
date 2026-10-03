import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { usePlansStore } from '../../stores/plansStore'
import { planDays, dayMeals, dayExercises } from '../../lib/utils/plan'
import { MealPlanDay, WorkoutPlanDay } from '../../types'
import { Screen, Card, Button, Heading, Text, EmptyState } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'
import { UtensilsCrossed, Dumbbell } from 'lucide-react-native'

export default function PlansScreen() {
  const { user } = useAuthStore()
  const colors = useThemeColors()
  const { mealPlan, workoutPlan, loading, generating, error, fetchPlans, generateMealPlan, generateWorkoutPlan } = usePlansStore()

  useEffect(() => { if (user) fetchPlans(user.id) }, [user])

  const mealDays = planDays<MealPlanDay>(mealPlan?.plan_json ?? null)
  const workoutDays = planDays<WorkoutPlanDay>(workoutPlan?.plan_json ?? null)

  return (
    <Screen title="Plans" scroll>
      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      {loading ? <ActivityIndicator color={colors.primary} className="mb-4" /> : null}

      {/* Meal plan */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Heading level={4} uppercase>Meal plan</Heading>
          <Button
            label="Regenerate"
            size="sm"
            fullWidth={false}
            loading={generating}
            onPress={() => user && generateMealPlan(user.id)}
          />
        </View>
        {mealDays.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="No meal plan yet"
            description="Tap Regenerate to have your coach build a 7-day meal plan."
          />
        ) : (
          <View className="gap-3">
            {mealDays.map((d, i) => (
              <Card key={`${d.day}-${i}`}>
                <Heading level={4} className="mb-2">{d.day}</Heading>
                <View className="gap-2">
                  {dayMeals(d).map((m, j) => (
                    <View key={j}>
                      <Text variant="label" className="capitalize">{m.meal_type}: {m.description}</Text>
                      <Text variant="caption" muted>
                        {m.calories} kcal · {m.protein_g}p / {m.carbs_g}c / {m.fat_g}f
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Workout plan */}
      <View className="mb-2">
        <View className="flex-row items-center justify-between mb-3">
          <Heading level={4} uppercase>Workout plan</Heading>
          <Button
            label="Regenerate"
            size="sm"
            fullWidth={false}
            loading={generating}
            onPress={() => user && generateWorkoutPlan(user.id)}
          />
        </View>
        {workoutDays.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workout plan yet"
            description="Tap Regenerate to have your coach build a weekly workout plan."
          />
        ) : (
          <View className="gap-3">
            {workoutDays.map((d, i) => (
              <Card key={`${d.day}-${i}`}>
                <Heading level={4}>{d.day}</Heading>
                <Text variant="caption" muted className="mb-2">{d.focus}</Text>
                <View className="gap-1.5">
                  {dayExercises(d).map((ex, j) => (
                    <View key={j}>
                      <Text variant="bodySm">{ex.name} — {ex.sets} × {ex.reps}</Text>
                      {ex.notes ? <Text variant="caption" muted>{ex.notes}</Text> : null}
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  )
}
