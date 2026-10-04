import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Flame, Snowflake } from 'lucide-react-native'
import { useChallengeStore } from '../../stores/challengeStore'
import { summarizeArc } from '../../lib/challenge/progress'
import { todayKey } from '../../lib/cache'
import { useThemeColors } from '../../lib/theme'
import { PressableScale } from '../motion'
import { Text } from '../ui'

// Home entry point: an invite while the arc is open to join, or today's arc progress.
export function ArcCard() {
  const router = useRouter()
  const colors = useThemeColors()
  const { challenge, rows } = useChallengeStore()
  const today = todayKey()

  if (!challenge) {
    // Only advertise the Winter Arc during its season (Oct-Dec).
    if (new Date().getUTCMonth() < 9) return null
    return (
      <PressableScale
        className="rounded-2xl p-4 flex-row items-center gap-3"
        style={{ backgroundColor: colors.arcSoft }}
        onPress={() => router.push('/challenge')}
        accessibilityRole="button"
        accessibilityLabel="Join the Winter Arc"
      >
        <Snowflake size={26} color={colors.arc} />
        <View className="flex-1">
          <Text className="font-display text-xl uppercase" style={{ color: colors.arc }}>Winter Arc is live</Text>
          <Text variant="caption" muted>Lock in until Dec 31 — finish the year transformed.</Text>
        </View>
        <ChevronRight size={20} color={colors.arc} />
      </PressableScale>
    )
  }

  const s = summarizeArc(rows, { startDate: challenge.start_date, endDate: challenge.end_date, strict: challenge.strict, today })
  const doneToday = s.today?.done ?? 0
  const totalToday = s.today?.total ?? challenge.rules.length
  return (
    <PressableScale
      className="rounded-2xl p-4"
      style={{ backgroundColor: colors.arcSoft }}
      onPress={() => router.push('/challenge')}
      accessibilityRole="button"
      accessibilityLabel={`${challenge.title}, day ${s.dayNumber} of ${s.totalDays}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Snowflake size={18} color={colors.arc} />
          <Text className="font-display text-lg uppercase" style={{ color: colors.arc }}>{challenge.title}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Flame size={16} color={colors.accent} />
          <Text variant="label">{s.currentStreak}</Text>
        </View>
      </View>
      <View className="flex-row items-baseline gap-2 mt-1">
        <Text className="font-display text-3xl text-foreground">Day {Math.min(s.dayNumber, s.totalDays)}</Text>
        <Text variant="bodySm" muted>of {s.totalDays} · today {doneToday}/{totalToday}</Text>
      </View>
      <View className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: '#123447' }}>
        <View className="h-1.5 rounded-full" style={{ width: `${totalToday ? (doneToday / totalToday) * 100 : 0}%`, backgroundColor: colors.arc }} />
      </View>
    </PressableScale>
  )
}
