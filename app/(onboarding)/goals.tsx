import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Dumbbell, Equal, Scale, SlidersHorizontal, TrendingDown } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { GoalType, Pace, PACE_KG_PER_WEEK, planTargets, suggestedTargetWeight } from '../../lib/utils/goalPlanner'
import { useThemeColors } from '../../lib/theme'
import { Screen, Heading, Text, Input, Button, Chip } from '../../components/ui'
import { CountUp, FadeIn, PressableScale } from '../../components/motion'

const GOALS: { id: GoalType; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'lose', label: 'Lose fat', hint: 'Lean out, keep muscle', icon: TrendingDown },
  { id: 'maintain', label: 'Maintain', hint: 'Stay where you are', icon: Equal },
  { id: 'gain', label: 'Build muscle', hint: 'Lean bulk', icon: Dumbbell },
]

const PACES: { id: Pace; label: string }[] = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'steady', label: 'Steady' },
  { id: 'fast', label: 'Fast' },
]

const text = (n: number | null | undefined): string => (n || n === 0 ? String(n) : '')

function paceFromRate(goal: GoalType, rate: number | null | undefined): Pace {
  if (goal === 'maintain' || !rate) return 'steady'
  const table = PACE_KG_PER_WEEK[goal]
  return (Object.keys(table) as Pace[]).reduce((best, p) => (Math.abs(table[p] - rate) < Math.abs(table[best] - rate) ? p : best), 'steady')
}

function Tile({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View className="flex-1 bg-surface-muted rounded-2xl p-3">
      <Text variant="caption" style={{ color }}>{label}</Text>
      <Text className="font-display text-2xl text-foreground">
        {value.toLocaleString()}
        <Text className="font-display text-base text-foreground">{unit}</Text>
      </Text>
    </View>
  )
}

// Coach-style goals: pick a goal, target and pace; targets are calculated (with an optional
// manual override) instead of asking users for calories and macros they don't know.
export default function OnboardingGoalsScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  // Profile opens this screen with ?mode=edit to change existing goals.
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit'
  const { user } = useAuthStore()
  const { profile, goals, upsertGoals, loading, error } = useProfileStore()

  const current = profile?.current_weight_kg ?? 0
  const initialGoal: GoalType =
    goals?.goal_type ??
    (goals ? (goals.target_weight_kg < current - 0.5 ? 'lose' : goals.target_weight_kg > current + 0.5 ? 'gain' : 'maintain') : 'lose')
  const [goal, setGoal] = useState<GoalType>(initialGoal)
  const [pace, setPace] = useState<Pace>(paceFromRate(initialGoal, goals?.weekly_rate_kg))
  const [targetWeight, setTargetWeight] = useState(
    text(goals?.target_weight_kg ?? (profile ? suggestedTargetWeight(profile, initialGoal) : null))
  )
  const [custom, setCustom] = useState(false)
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [steps, setSteps] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const target = parseFloat(targetWeight)
  const plan = useMemo(
    () => (profile && Number.isFinite(target) && target > 20 ? planTargets(profile, { goal, targetWeightKg: target, pace }) : null),
    [profile, goal, target, pace]
  )

  const chooseGoal = (g: GoalType) => {
    setGoal(g)
    if (profile) setTargetWeight(String(suggestedTargetWeight(profile, g)))
  }

  const toggleCustom = () => {
    if (!custom && plan) {
      setCalories(String(goals?.daily_calorie_target ?? plan.calories))
      setProtein(String(goals?.daily_protein_g ?? plan.protein))
      setCarbs(String(goals?.daily_carbs_g ?? plan.carbs))
      setFat(String(goals?.daily_fat_g ?? plan.fat))
      setSteps(String(goals?.daily_steps_target ?? plan.steps))
    }
    setCustom((v) => !v)
  }

  const handleSave = async () => {
    if (!user) return
    if (!Number.isFinite(target) || target < 25 || target > 350) {
      setFormError('Enter a target weight between 25 and 350 kg.')
      return
    }
    const values = custom
      ? {
          daily_calorie_target: parseInt(calories, 10),
          daily_protein_g: parseInt(protein, 10),
          daily_carbs_g: parseInt(carbs, 10),
          daily_fat_g: parseInt(fat, 10),
          daily_steps_target: parseInt(steps, 10),
        }
      : plan
        ? {
            daily_calorie_target: plan.calories,
            daily_protein_g: plan.protein,
            daily_carbs_g: plan.carbs,
            daily_fat_g: plan.fat,
            daily_steps_target: plan.steps,
          }
        : null
    if (!values || Object.values(values).some((v) => !Number.isFinite(v) || v < 0) || values.daily_calorie_target < 800) {
      setFormError('Fill in every target with a valid number (at least 800 kcal a day).')
      return
    }
    setFormError(null)
    // Goals are append-only: carry over what this form doesn't edit (coach-set targets/notes).
    await upsertGoals({
      user_id: user.id,
      target_body_fat_pct: goals?.target_body_fat_pct ?? null,
      target_muscle_mass_kg: goals?.target_muscle_mass_kg ?? null,
      notes: goals?.notes ?? '',
      goal_type: goal,
      weekly_rate_kg: plan?.weeklyRateKg ?? null,
      target_weight_kg: target,
      ...values,
    })
    if (useProfileStore.getState().error !== null) return
    if (editing) router.back()
    else router.replace('/(tabs)')
  }

  const eta =
    plan && plan.weeksToTarget > 0
      ? new Date(Date.now() + plan.weeksToTarget * 7 * 24 * 3600 * 1000).toLocaleDateString([], { month: 'short', year: 'numeric' })
      : null
  const delta = plan ? plan.calories - plan.maintenanceCalories : 0
  const shownError = formError ?? error

  return (
    <Screen
      scroll
      back={editing}
      title={editing ? 'Goals' : undefined}
      footer={<Button label={editing ? 'Save changes' : 'Start coaching'} loading={loading} onPress={handleSave} />}
    >
      {editing ? null : (
        <View className="mt-1 mb-6">
          <Text variant="caption" muted className="uppercase tracking-wide">Step 2 of 2</Text>
          <Heading level={1} uppercase>Your goal</Heading>
          <Text variant="body" muted className="mt-1">Tell us where you want to get to — we&apos;ll work out the daily numbers.</Text>
        </View>
      )}

      {shownError ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{shownError}</Text>
        </View>
      ) : null}

      <View className="gap-2.5 mb-5">
        {GOALS.map(({ id, label, hint, icon: Icon }, i) => {
          const selected = goal === id
          return (
            <FadeIn key={id} index={i}>
              <PressableScale
                onPress={() => chooseGoal(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`flex-row items-center gap-3 rounded-2xl p-4 ${selected ? 'bg-primary-soft border-2 border-primary' : 'bg-surface border-2 border-transparent'}`}
              >
                <Icon size={22} color={selected ? colors.primary : colors.mutedForeground} />
                <View className="flex-1">
                  <Text variant="label">{label}</Text>
                  <Text variant="caption" muted>{hint}</Text>
                </View>
              </PressableScale>
            </FadeIn>
          )
        })}
      </View>

      <Input label="Target weight (kg)" icon={Scale} keyboardType="decimal-pad" value={targetWeight} onChangeText={setTargetWeight} containerClassName="mb-4" />

      {goal !== 'maintain' ? (
        <View className="mb-5">
          <Text variant="label" className="mb-1.5">Pace</Text>
          <View className="flex-row flex-wrap gap-2">
            {PACES.map((p) => (
              <Chip
                key={p.id}
                label={`${p.label} · ${PACE_KG_PER_WEEK[goal][p.id]} kg/wk`}
                selected={pace === p.id}
                onPress={() => setPace(p.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {plan && !custom ? (
        <FadeIn index={3} className="bg-surface rounded-3xl p-4 mb-3">
          <Text variant="caption" muted className="uppercase tracking-wide">Your daily plan</Text>
          <View className="flex-row items-baseline gap-2 mt-1">
            <CountUp value={plan.calories} className="font-display text-5xl" style={{ color: colors.macroCalories }} />
            <Text variant="body" muted>kcal</Text>
          </View>
          <Text variant="bodySm" muted>
            Maintenance {plan.maintenanceCalories.toLocaleString()} kcal
            {delta !== 0 ? ` · ${delta > 0 ? '+' : '−'}${Math.abs(delta)} a day` : ''}
          </Text>
          <View className="flex-row gap-2 mt-3">
            <Tile label="Protein" value={plan.protein} unit="g" color={colors.macroProtein} />
            <Tile label="Carbs" value={plan.carbs} unit="g" color={colors.macroCarbs} />
            <Tile label="Fat" value={plan.fat} unit="g" color={colors.macroFat} />
          </View>
          <View className="flex-row gap-2 mt-2">
            <Tile label="Steps" value={plan.steps} unit="" color={colors.macroSteps} />
            {eta ? (
              <View className="flex-1 bg-surface-muted rounded-2xl p-3">
                <Text variant="caption" style={{ color: colors.primary }}>Reach {target} kg</Text>
                <Text className="font-display text-2xl text-foreground">{eta}</Text>
              </View>
            ) : null}
          </View>
          {plan.limitedBySafetyFloor ? (
            <Text variant="caption" className="text-warning mt-3">
              We kept calories at a safe minimum, so this may take a little longer than the pace suggests.
            </Text>
          ) : null}
        </FadeIn>
      ) : null}

      <Button label={custom ? 'Use the calculated plan' : 'Customize targets'} variant="ghost" icon={SlidersHorizontal} onPress={toggleCustom} />

      {custom ? (
        <View className="gap-3 mt-2">
          <Input label="Daily calories (kcal)" keyboardType="number-pad" value={calories} onChangeText={setCalories} />
          <View className="flex-row gap-3">
            <View className="flex-1"><Input label="Protein (g)" keyboardType="number-pad" value={protein} onChangeText={setProtein} /></View>
            <View className="flex-1"><Input label="Carbs (g)" keyboardType="number-pad" value={carbs} onChangeText={setCarbs} /></View>
            <View className="flex-1"><Input label="Fat (g)" keyboardType="number-pad" value={fat} onChangeText={setFat} /></View>
          </View>
          <Input label="Daily steps" keyboardType="number-pad" value={steps} onChangeText={setSteps} />
        </View>
      ) : null}
    </Screen>
  )
}
