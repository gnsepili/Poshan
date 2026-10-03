import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Plus,
  MessageCircle,
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
import {
  Screen,
  Card,
  PressableCard,
  Button,
  Heading,
  Text,
  ProgressRing,
  MacroBar,
  EmptyState,
} from '../../components/ui'
import { useThemeColors } from '../../lib/theme'
import { calcProgress, sumMeals } from '../../lib/utils/macros'
import { sumSteps } from '../../lib/utils/activity'
import { generateDailySummary } from '../../lib/api/dailySummary'
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
  const { meals, fetchTodayMeals, error: mealsError } = useMealsStore()
  const { goals, fetchGoals, error: profileError } = useProfileStore()
  const { summary, loaded: summaryLoaded, fetchOrCreateToday, error: summaryError } = useDailySummaryStore()
  const { todayActivity, fetchTodayActivity, error: activityError } = useActivityStore()
  const { available: hcAvailable, permissionGranted: hcGranted, todaySteps: hcSteps, checkAvailability, syncNow } = useHealthConnectStore()
  const [lazyError, setLazyError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchTodayMeals(user.id)
      fetchGoals(user.id)
      fetchOrCreateToday(user.id)
      fetchTodayActivity(user.id)
    }
  }, [user])

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
    <Screen scroll>
      {/* Greeting */}
      <View className="mt-1 mb-5">
        <Text variant="caption" muted className="uppercase tracking-wide">
          {greeting(new Date())}
        </Text>
        <Heading level={1} uppercase>Today</Heading>
      </View>

      {errorMessage ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{errorMessage}</Text>
        </View>
      ) : null}

      {/* Hero stats */}
      <Card elevated className="mb-3">
        <View className="flex-row items-baseline justify-between mb-4">
          <View>
            <Text variant="caption" muted className="uppercase tracking-wide">Calories left</Text>
            <View className="flex-row items-baseline gap-1.5">
              <Text className="font-display text-4xl text-foreground">{caloriesLeft}</Text>
              <Text variant="bodySm" muted>of {calorieTarget}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row justify-around">
          <ProgressRing percentage={calcProgress(totals.calories, calorieTarget)} label="Calories" value={`${totals.calories}`} color={colors.primary} />
          <ProgressRing percentage={calcProgress(totals.protein, proteinTarget)} label="Protein" value={`${Math.round(totals.protein)}g`} color={colors.info} />
          <ProgressRing percentage={calcProgress(stepsToday, stepsTarget)} label="Steps" value={`${stepsToday}`} color={colors.warning} />
        </View>
      </Card>

      {/* Primary actions */}
      <View className="flex-row gap-3 mb-3">
        <Button label="Log Meal" variant="accent" icon={Plus} fullWidth={false} className="flex-1" onPress={() => router.push('/(tabs)/meals')} />
        <Button label="Ask Coach" variant="secondary" icon={MessageCircle} fullWidth={false} className="flex-1" onPress={() => router.push('/(tabs)/chat')} />
      </View>

      {/* Secondary actions */}
      <View className="flex-row gap-3 mb-5">
        <QuickAction icon={ActivityIcon} label="Activity" onPress={() => router.push('/activity')} color={colors.primary} />
        <QuickAction icon={Scale} label="InBody" onPress={() => router.push('/inbody')} color={colors.info} />
        <QuickAction icon={TrendingUp} label="Progress" onPress={() => router.push('/progress')} color={colors.accent} />
      </View>

      {/* Macros */}
      <Card className="mb-5">
        <Heading level={4} uppercase className="mb-3">Macros</Heading>
        <MacroBar label="Protein" consumed={totals.protein} target={proteinTarget} color={colors.macroProtein} />
        <MacroBar label="Carbs" consumed={totals.carbs} target={carbsTarget} color={colors.macroCarbs} />
        <MacroBar label="Fat" consumed={totals.fat} target={fatTarget} color={colors.macroFat} />
      </Card>

      {/* Coach note */}
      {summary?.ai_coach_note ? (
        <Card className="mb-5 bg-primary-soft border-0">
          <View className="flex-row items-start gap-2.5">
            <Sparkles size={18} color={colors.primary} />
            <Text variant="bodySm" className="flex-1 text-foreground">{summary.ai_coach_note}</Text>
          </View>
        </Card>
      ) : null}

      {/* Low-fuel prompt */}
      {shouldShowLowFuelPrompt(totals.calories, calorieTarget, new Date()) ? (
        <PressableCard className="mb-5 bg-accent-soft border-0" onPress={() => router.push('/(tabs)/chat')}>
          <View className="flex-row items-start gap-2.5">
            <AlertTriangle size={18} color={colors.accent} />
            <View className="flex-1">
              <Text variant="label" className="text-accent">Not enough food today</Text>
              <Text variant="caption" muted className="mt-0.5">
                You&apos;re well under your calorie target — tap to ask the coach for a meal idea.
              </Text>
            </View>
          </View>
        </PressableCard>
      ) : null}

      {/* Today's meals */}
      <Heading level={4} uppercase className="mb-3">Today&apos;s meals</Heading>
      {meals.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No meals yet"
          description="Log your first meal to start tracking today's macros."
          actionLabel="Log a meal"
          onAction={() => router.push('/(tabs)/meals')}
        />
      ) : (
        <View className="gap-3">
          {meals.map((m) => <MealCard key={m.id} meal={m} />)}
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
    <PressableCard className="flex-1 items-center py-4" onPress={onPress}>
      <Icon size={22} color={color} />
      <Text variant="caption" className="mt-1.5 font-semibold">{label}</Text>
    </PressableCard>
  )
}
