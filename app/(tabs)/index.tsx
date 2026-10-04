import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Activity as ActivityIcon,
  Scale,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  UtensilsCrossed,
} from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { useProfileStore } from '../../stores/profileStore'
import { useDailySummaryStore } from '../../stores/dailySummaryStore'
import { useActivityStore } from '../../stores/activityStore'
import { useHealthConnectStore } from '../../stores/healthConnectStore'
import { MealCard } from '../../components/meals/MealCard'
import { Screen, Heading, Text, EmptyState } from '../../components/ui'
import { FadeIn, PressableScale } from '../../components/motion'
import { TodayRings } from '../../components/home/TodayRings'
import { MacroTile } from '../../components/home/MacroTile'
import { ArcCard } from '../../components/challenge/ArcCard'
import { useChallengeStore } from '../../stores/challengeStore'
import { useThemeColors } from '../../lib/theme'
import { sumMeals } from '../../lib/utils/macros'
import { sumSteps } from '../../lib/utils/activity'
import { generateDailySummary } from '../../lib/api/dailySummary'
import { useAutoRefresh } from '../../lib/hooks/useAutoRefresh'
import { shouldGenerateAfterLoad, shouldShowLowFuelPrompt } from '../../lib/utils/coachNote'
import type { LucideIcon } from 'lucide-react-native'

// Fires the lazy coach-note generation at most once per app session per calendar day.
let coachNoteAttemptDate: string | null = null

function greeting(d: Date) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals, pendingCount, error: mealsError } = useMealsStore()
  const { goals, fetchGoals, error: profileError } = useProfileStore()
  const { summary, loaded: summaryLoaded, fetchOrCreateToday, error: summaryError } = useDailySummaryStore()
  const { todayActivity, fetchTodayActivity, error: activityError } = useActivityStore()
  const { available: hcAvailable, permissionGranted: hcGranted, todaySteps: hcSteps, checkAvailability, syncNow } = useHealthConnectStore()
  const [lazyError, setLazyError] = useState<string | null>(null)

  const { refreshing, onRefresh } = useAutoRefresh(
    () =>
      user
        ? Promise.all([
            fetchTodayMeals(user.id),
            fetchGoals(user.id),
            fetchOrCreateToday(user.id),
            fetchTodayActivity(user.id),
            hcAvailable && hcGranted ? syncNow(user.id) : undefined,
            useChallengeStore.getState().fetchActive(user.id),
          ])
        : undefined,
    { enabled: !!user }
  )

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    if (user && shouldGenerateAfterLoad(summaryLoaded, summary, coachNoteAttemptDate, today)) {
      coachNoteAttemptDate = today
      generateDailySummary()
        .then(() => fetchOrCreateToday(user.id))
        .catch((e) => setLazyError(e instanceof Error ? e.message : String(e)))
    }
  }, [user, summary, summaryLoaded])

  useEffect(() => { checkAvailability() }, [])
  useEffect(() => {
    if (user && hcAvailable && hcGranted) syncNow(user.id)
  }, [user, hcAvailable, hcGranted])

  const totals = sumMeals(meals)
  const calorieTarget = goals?.daily_calorie_target ?? 2000
  const proteinTarget = goals?.daily_protein_g ?? 150
  const carbsTarget = goals?.daily_carbs_g ?? 250
  const fatTarget = goals?.daily_fat_g ?? 70
  const stepsToday = Math.max(sumSteps(todayActivity), hcSteps)
  const stepsTarget = goals?.daily_steps_target ?? 8000
  const caloriesLeft = Math.max(0, calorieTarget - totals.calories)
  const errorMessage = mealsError ?? profileError ?? summaryError ?? activityError ?? lazyError

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <FadeIn index={0} className="mt-1 mb-4">
        <Text variant="bodySm" muted>
          {greeting(new Date())}
        </Text>
        <Heading level={1} uppercase>
          Today
        </Heading>
      </FadeIn>

      {pendingCount > 0 ? (
        <View className="bg-accent-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-accent font-semibold">
            {pendingCount} meal{pendingCount > 1 ? 's' : ''} saved offline — will sync automatically.
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <FadeIn index={1} className="mb-3">
        <TodayRings
          calories={{ label: 'Calories', value: totals.calories, target: calorieTarget }}
          protein={{ label: 'Protein', value: Math.round(totals.protein), target: proteinTarget, unit: 'g' }}
          steps={{ label: 'Steps', value: stepsToday, target: stepsTarget }}
        />
        <Text variant="bodySm" muted className="mt-2 px-1">
          {caloriesLeft > 0 ? `${caloriesLeft.toLocaleString()} kcal left today` : 'Calorie target reached for today'}
        </Text>
      </FadeIn>

      <FadeIn index={2} className="flex-row gap-2.5 mb-3">
        <MacroTile label="Protein" value={totals.protein} target={proteinTarget} color={colors.macroProtein} trackColor={colors.macroProteinSoft} />
        <MacroTile label="Carbs" value={totals.carbs} target={carbsTarget} color={colors.macroCarbs} trackColor={colors.macroCarbsSoft} />
        <MacroTile label="Fat" value={totals.fat} target={fatTarget} color={colors.macroFat} trackColor={colors.macroFatSoft} />
      </FadeIn>

      <FadeIn index={3} className="mb-3">
        <ArcCard />
      </FadeIn>

      {summary?.ai_coach_note ? (
        <FadeIn index={3} className="mb-3">
          <PressableScale className="bg-surface rounded-2xl p-4 flex-row items-start gap-3" onPress={() => router.push('/(tabs)/chat')}>
            <Sparkles size={18} color={colors.primary} />
            <Text variant="bodySm" className="flex-1 text-foreground">
              {summary.ai_coach_note}
            </Text>
          </PressableScale>
        </FadeIn>
      ) : null}

      {shouldShowLowFuelPrompt(totals.calories, calorieTarget, new Date()) ? (
        <FadeIn index={4} className="mb-3">
          <PressableScale className="bg-accent-soft rounded-2xl p-4 flex-row items-start gap-3" onPress={() => router.push('/(tabs)/chat')}>
            <AlertTriangle size={18} color={colors.accent} />
            <View className="flex-1">
              <Text variant="label" className="text-accent">
                Not enough food today
              </Text>
              <Text variant="caption" muted className="mt-0.5">
                You&apos;re well under your calorie target — ask the coach for a meal idea.
              </Text>
            </View>
          </PressableScale>
        </FadeIn>
      ) : null}

      <FadeIn index={5} className="flex-row gap-2.5 mb-6">
        <QuickAction icon={ActivityIcon} label="Activity" onPress={() => router.push('/activity')} color={colors.macroSteps} />
        <QuickAction icon={Scale} label="InBody" onPress={() => router.push('/inbody')} color={colors.macroCarbs} />
        <QuickAction icon={TrendingUp} label="Progress" onPress={() => router.push('/progress')} color={colors.macroProtein} />
      </FadeIn>

      <View className="flex-row items-center justify-between mb-3">
        <Heading level={4} uppercase>
          Today&apos;s meals
        </Heading>
        {meals.length > 0 ? (
          <Text variant="bodySm" className="text-macro-calories font-semibold">
            {totals.calories.toLocaleString()} kcal
          </Text>
        ) : null}
      </View>
      {meals.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No meals yet"
          description="Snap your first meal to start tracking today's macros."
          actionLabel="Snap a meal"
          onAction={() => router.push('/meal/new')}
        />
      ) : (
        <View className="gap-3">
          {meals.map((m, i) => (
            <FadeIn key={m.id} index={6 + i}>
              <MealCard meal={m} onPress={() => router.push(`/meal/${m.id}`)} />
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
  color,
}: {
  icon: LucideIcon
  label: string
  onPress: () => void
  color: string
}) {
  return (
    <View className="flex-1">
      <PressableScale className="bg-surface rounded-2xl items-center py-4" onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <Icon size={22} color={color} />
        <Text variant="caption" className="mt-1.5 font-semibold">
          {label}
        </Text>
      </PressableScale>
    </View>
  )
}
