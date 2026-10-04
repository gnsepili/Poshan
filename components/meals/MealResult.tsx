import { ReactNode } from 'react'
import { Image, View } from 'react-native'
import Svg from 'react-native-svg'
import { Camera, Sparkles } from 'lucide-react-native'
import { MealItem, MealType } from '../../types'
import { AnimatedRing, CountUp, FadeIn } from '../motion'
import { Text } from '../ui'
import { useThemeColors } from '../../lib/theme'
import { useSignedPhoto } from '../../lib/hooks/useSignedPhoto'
import { scoreTone, shareOfTarget } from '../../lib/utils/mealScore'

export interface MealResultData {
  title: string
  mealType: MealType
  loggedAt?: string
  /** Storage path, legacy URL, or local file URI. */
  photo?: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  items: MealItem[]
  score: number | null
  scoreLabel: string | null
  tip: string | null
}

export interface DailyTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

function MacroRing({ grams, target, label, color, track, index }: { grams: number; target: number; label: string; color: string; track: string; index: number }) {
  const size = 64
  return (
    <View className="flex-1 items-center">
      <Svg width={size} height={size}>
        <AnimatedRing cx={size / 2} cy={size / 2} radius={26} thickness={7} progress={target > 0 ? grams / target : 0} color={color} trackColor={track} delayMs={200 + index * 120} />
      </Svg>
      <Text className="font-display text-xl text-foreground mt-1">{Math.round(grams)}g</Text>
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
      <Text variant="caption" muted>
        {shareOfTarget(grams, target)}% of day
      </Text>
    </View>
  )
}

// The rich meal view: photo, calories, macro rings, item breakdown, score and coach tip.
// `children` renders the actions (e.g. Log meal / Edit) at the bottom.
export function MealResult({ data, targets, children }: { data: MealResultData; targets: DailyTargets; children?: ReactNode }) {
  const colors = useThemeColors()
  const signed = useSignedPhoto('meal-photos', data.photo)
  const tone = scoreTone(data.score)
  const toneStyle =
    tone === 'good'
      ? { bg: colors.primarySoft, fg: colors.success }
      : tone === 'ok'
        ? { bg: colors.accentSoft, fg: colors.warning }
        : { bg: '#331414', fg: colors.danger }
  const time = data.loggedAt ? new Date(data.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null

  return (
    <View>
      <FadeIn index={0}>
        {signed ? (
          <Image source={{ uri: signed }} className="w-full h-56 rounded-3xl bg-surface-muted" resizeMode="cover" accessibilityLabel={`Photo of ${data.title}`} />
        ) : (
          <View className="w-full h-40 rounded-3xl bg-surface items-center justify-center">
            <Camera size={28} color={colors.mutedForeground} />
          </View>
        )}
      </FadeIn>

      <FadeIn index={1} className="mt-4">
        <Text variant="caption" muted className="uppercase tracking-wide">
          {MEAL_LABEL[data.mealType]}
          {time ? ` · ${time}` : ''}
        </Text>
        <View className="flex-row items-start justify-between gap-3 mt-0.5">
          <Text className="font-display text-3xl text-foreground flex-1" numberOfLines={2}>
            {data.title || 'Your meal'}
          </Text>
          {tone && data.score ? (
            <View className="rounded-full px-3 py-1 mt-1" style={{ backgroundColor: toneStyle.bg }}>
              <Text variant="caption" className="font-bold" style={{ color: toneStyle.fg }}>
                {data.score}/10{data.scoreLabel ? ` · ${data.scoreLabel}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-baseline gap-2 mt-2">
          <CountUp value={data.calories} className="font-display text-5xl" style={{ color: colors.macroCalories }} />
          <Text variant="body" muted>
            kcal · {shareOfTarget(data.calories, targets.calories)}% of today
          </Text>
        </View>
      </FadeIn>

      <FadeIn index={2} className="flex-row bg-surface rounded-3xl py-4 mt-4">
        <MacroRing grams={data.protein_g} target={targets.protein} label="Protein" color={colors.macroProtein} track={colors.macroProteinSoft} index={0} />
        <MacroRing grams={data.carbs_g} target={targets.carbs} label="Carbs" color={colors.macroCarbs} track={colors.macroCarbsSoft} index={1} />
        <MacroRing grams={data.fat_g} target={targets.fat} label="Fat" color={colors.macroFat} track={colors.macroFatSoft} index={2} />
      </FadeIn>

      {data.items.length > 0 ? (
        <FadeIn index={3} className="bg-surface rounded-3xl px-4 py-2 mt-3">
          {data.items.map((item, i) => (
            <View key={`${item.name}-${i}`} className={`flex-row items-center justify-between py-2.5 ${i < data.items.length - 1 ? 'border-b border-border' : ''}`}>
              <View className="flex-1 pr-3">
                <Text variant="body">{item.name}</Text>
                {item.portion ? (
                  <Text variant="caption" muted>
                    {item.portion} · P {Math.round(item.protein_g)} · C {Math.round(item.carbs_g)} · F {Math.round(item.fat_g)}
                  </Text>
                ) : null}
              </View>
              <Text variant="bodySm" className="font-semibold" style={{ color: colors.macroCalories }}>
                {item.calories} kcal
              </Text>
            </View>
          ))}
        </FadeIn>
      ) : null}

      {data.tip ? (
        <FadeIn index={4} className="bg-surface rounded-3xl p-4 mt-3 flex-row items-start gap-3">
          <Sparkles size={18} color={colors.primary} />
          <Text variant="bodySm" className="flex-1 text-foreground">
            {data.tip}
          </Text>
        </FadeIn>
      ) : null}

      {children ? <FadeIn index={5} className="mt-5">{children}</FadeIn> : null}
    </View>
  )
}
