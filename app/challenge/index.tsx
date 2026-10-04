import { useMemo, useState } from 'react'
import { Alert, Platform, View } from 'react-native'
import Svg from 'react-native-svg'
import { useRouter } from 'expo-router'
import { Check, Flame, Lock, Snowflake, Sparkles, Trophy } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useChallengeStore } from '../../stores/challengeStore'
import { useProfileStore } from '../../stores/profileStore'
import { useInbodyStore } from '../../stores/inbodyStore'
import { arcWindow, CLASSIC_RULES, RULES, ruleById } from '../../lib/challenge/rules'
import { ArcRow, summarizeArc } from '../../lib/challenge/progress'
import { todayKey } from '../../lib/cache'
import { useAutoRefresh } from '../../lib/hooks/useAutoRefresh'
import { useThemeColors } from '../../lib/theme'
import { Screen, Heading, Text, Button } from '../../components/ui'
import { AnimatedRing, CountUp, FadeIn, PressableScale, tapHaptic } from '../../components/motion'

const prettyDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString([], { day: 'numeric', month: 'short' })

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${message}`)) onYes()
    return
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: onYes },
  ])
}

// `dimWhenDone`: on the daily checklist a finished rule fades; when picking rules, a
// selected rule must stay bright (it means "included", not "finished").
function CheckRow({ label, hint, done, auto, onPress, color, dimWhenDone = true }: { label: string; hint: string; done: boolean; auto: boolean; onPress?: () => void; color: string; dimWhenDone?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      haptic={!!onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !onPress }}
      className="flex-row items-center gap-3 py-3"
    >
      <View
        className="h-7 w-7 rounded-full items-center justify-center"
        style={{ backgroundColor: done ? color : 'transparent', borderWidth: done ? 0 : 2, borderColor: '#2A2A2E' }}
      >
        {done ? <Check size={16} color="#04121A" strokeWidth={3} /> : null}
      </View>
      <View className="flex-1">
        <Text variant="body" className={done && dimWhenDone ? 'text-muted-foreground' : 'text-foreground'}>{label}</Text>
        <Text variant="caption" muted>{hint}</Text>
      </View>
      {auto ? <Text variant="caption" style={{ color }}>auto</Text> : null}
    </PressableScale>
  )
}

function JoinView() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { profile } = useProfileStore()
  const { latest } = useInbodyStore()
  const { join, loading, error } = useChallengeStore()
  const window = arcWindow()
  const [rules, setRules] = useState<string[]>(CLASSIC_RULES)
  const [strict, setStrict] = useState(false)
  const startWeight = latest?.weight_kg ?? profile?.current_weight_kg ?? null
  const startFat = latest?.body_fat_pct ?? null
  const days = Math.round((Date.parse(`${window.endDate}T00:00:00Z`) - Date.parse(`${window.startDate}T00:00:00Z`)) / 86400000) + 1

  const toggle = (id: string) => setRules((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))
  const start = async () => {
    if (!user || rules.length === 0) return
    const ok = await join({ userId: user.id, title: window.title, startDate: window.startDate, endDate: window.endDate, rules, strict, startWeightKg: startWeight, startBodyFatPct: startFat })
    if (ok) tapHaptic()
  }

  return (
    <Screen
      back
      scroll
      footer={<Button label={`Start my arc · ${rules.length} rules`} loading={loading} disabled={rules.length === 0} onPress={start} />}
    >
      <FadeIn index={0} className="items-center mt-2 mb-6">
        <View className="h-20 w-20 rounded-full items-center justify-center mb-3" style={{ backgroundColor: colors.arcSoft }}>
          <Snowflake size={40} color={colors.arc} />
        </View>
        <Heading level={1} uppercase style={{ color: colors.arc }}>{window.title}</Heading>
        <Text variant="body" muted className="text-center mt-1">
          {days} days, {prettyDate(window.startDate)} – {prettyDate(window.endDate)}. Go quiet, lock in, and finish the year as a different person.
        </Text>
      </FadeIn>

      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      {(['auto', 'manual'] as const).map((kind, k) => (
        <FadeIn key={kind} index={1 + k} className="bg-surface rounded-3xl px-4 py-2 mb-3">
          <Text variant="caption" muted className="uppercase tracking-wide mt-2">
            {kind === 'auto' ? 'Tracked automatically' : 'Daily check-ins'}
          </Text>
          {RULES.filter((r) => r.kind === kind).map((r) => (
            <CheckRow key={r.id} label={r.label} hint={r.hint} done={rules.includes(r.id)} auto={false} dimWhenDone={false} onPress={() => toggle(r.id)} color={colors.arc} />
          ))}
        </FadeIn>
      ))}

      <FadeIn index={3} className="mb-3">
        <Text variant="label" className="mb-2">Mode</Text>
        <View className="flex-row gap-2.5">
          {[
            { id: false, title: 'Streak', hint: 'Miss a day, your streak resets — the arc goes on.', icon: Flame },
            { id: true, title: 'Strict', hint: 'Miss a day and you start again at day 1.', icon: Lock },
          ].map((m) => {
            const selected = strict === m.id
            const Icon = m.icon
            return (
              <View key={m.title} className="flex-1">
                <PressableScale
                  onPress={() => setStrict(m.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className="rounded-2xl p-3"
                  style={{ backgroundColor: selected ? colors.arcSoft : colors.surface, borderWidth: 2, borderColor: selected ? colors.arc : 'transparent' }}
                >
                  <Icon size={20} color={selected ? colors.arc : colors.mutedForeground} />
                  <Text variant="label" className="mt-1.5">{m.title}</Text>
                  <Text variant="caption" muted>{m.hint}</Text>
                </PressableScale>
              </View>
            )
          })}
        </View>
      </FadeIn>

      {startWeight ? (
        <FadeIn index={4}>
          <Text variant="caption" muted className="mt-2">
            We&apos;ll record your starting point — {startWeight} kg{startFat ? `, ${startFat}% body fat` : ''} — for your before/after at the end.
          </Text>
        </FadeIn>
      ) : null}
      <Button label="Not now" variant="ghost" className="mt-3" onPress={() => router.back()} />
    </Screen>
  )
}

function Heatmap({ start, end, days, today }: { start: string; end: string; days: Map<string, { done: number; total: number }>; today: string }) {
  const colors = useThemeColors()
  const cells = useMemo(() => {
    const out: string[] = []
    for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().split('T')[0])
    return out
  }, [start, end])
  return (
    <View className="flex-row flex-wrap" style={{ gap: 5 }}>
      {cells.map((d) => {
        const v = days.get(d)
        const ratio = v && v.total ? v.done / v.total : 0
        return <View key={d} style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: heatColor(d, today, ratio, colors.arc), borderWidth: d === today ? 1.5 : 0, borderColor: '#F5F5F5' }} />
      })}
    </View>
  )
}

const HEAT = { upcoming: '#2A2A2E', missed: '#4A1F24', some: '#1E4A63' }

// Upcoming days stay visible (so the whole arc's length shows), missed days read as misses.
function heatColor(date: string, today: string, ratio: number, full: string): string {
  if (date > today) return HEAT.upcoming
  if (ratio >= 1) return full
  if (ratio === 0) return date === today ? HEAT.upcoming : HEAT.missed
  return ratio < 0.5 ? HEAT.some : '#2A7DA8'
}

function HeatLegend() {
  const colors = useThemeColors()
  const items: [string, string][] = [
    [colors.arc, 'All done'],
    ['#2A7DA8', 'Most'],
    [HEAT.missed, 'Missed'],
    [HEAT.upcoming, 'Upcoming'],
  ]
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-3">
      {items.map(([c, label]) => (
        <View key={label} className="flex-row items-center gap-1.5">
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
          <Text variant="caption" muted>{label}</Text>
        </View>
      ))}
    </View>
  )
}

// "94.2 kg  −1.4" — current value with the change since the arc started (down is good).
function Delta({ label, from, to, unit }: { label: string; from: number; to: number | null; unit: string }) {
  const colors = useThemeColors()
  const change = to === null ? null : Math.round((to - from) * 10) / 10
  return (
    <View className="flex-1 bg-surface-muted rounded-2xl p-3">
      <Text variant="caption" muted>{label}</Text>
      <Text className="font-display text-2xl text-foreground">
        {to ?? from}
        <Text className="font-display text-base text-foreground"> {unit}</Text>
      </Text>
      <Text variant="caption" style={{ color: change === null || change === 0 ? colors.mutedForeground : change < 0 ? colors.success : colors.warning }}>
        {change === null ? `Start ${from}${unit === '%' ? '%' : ` ${unit}`} · scan to update` : change === 0 ? `No change since day 1` : `${change > 0 ? '+' : '−'}${Math.abs(change)} ${unit} since day 1`}
      </Text>
    </View>
  )
}

function ArcDashboard() {
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { profile } = useProfileStore()
  const { latest } = useInbodyStore()
  const { challenge, rows, toggleRule, leave, fetchActive, error } = useChallengeStore()
  const { refreshing, onRefresh } = useAutoRefresh(() => (user ? fetchActive(user.id) : undefined), { enabled: !!user, staleMs: 30_000 })
  if (!challenge) return null

  const today = todayKey()
  const s = summarizeArc(rows, { startDate: challenge.start_date, endDate: challenge.end_date, strict: challenge.strict, today })
  const finished = today > challenge.end_date
  const todayRows = new Map<string, ArcRow>(rows.filter((r) => r.day === today).map((r) => [r.rule_id, r]))
  const dayMap = new Map(s.days.map((d) => [d.date, d]))
  const nowWeight = latest?.weight_kg ?? profile?.current_weight_kg ?? null
  const nowFat = latest?.body_fat_pct ?? null
  const elapsed = Math.min(1, s.dayNumber / Math.max(1, s.totalDays))

  return (
    <Screen back scroll refreshing={refreshing} onRefresh={onRefresh}>
      <FadeIn index={0} className="mb-3">
        <View className="rounded-3xl p-5" style={{ backgroundColor: colors.arcSoft }}>
        <View className="flex-row items-center gap-2">
          <Snowflake size={18} color={colors.arc} />
          <Text className="font-display text-lg uppercase" style={{ color: colors.arc }}>{challenge.title}</Text>
          {challenge.strict ? <Lock size={14} color={colors.arc} /> : null}
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <View>
            <Text variant="caption" muted className="uppercase tracking-wide">{finished ? 'Arc complete' : 'Day'}</Text>
            <View className="flex-row items-baseline gap-1">
              <CountUp value={Math.min(s.dayNumber, s.totalDays)} className="font-display text-6xl text-foreground" />
              <Text className="font-display text-2xl" style={{ color: colors.mutedForeground }}>/ {s.totalDays}</Text>
            </View>
            <Text variant="caption" muted>
              {finished ? `Finished ${prettyDate(challenge.end_date)}` : `${Math.max(0, s.totalDays - s.dayNumber)} days left · ends ${prettyDate(challenge.end_date)}`}
            </Text>
          </View>
          <Svg width={96} height={96}>
            <AnimatedRing cx={48} cy={48} radius={40} thickness={10} progress={elapsed} color={colors.arc} trackColor="#123447" />
          </Svg>
        </View>
        {s.restartedOn ? (
          <Text variant="caption" className="mt-2" style={{ color: colors.warning }}>
            Strict mode: you restarted on {prettyDate(s.restartedOn)} after a missed day.
          </Text>
        ) : null}
        </View>
      </FadeIn>

      <FadeIn index={1} className="flex-row gap-2.5 mb-3">
        {[
          { label: 'Streak', value: s.currentStreak, icon: Flame, color: colors.accent },
          { label: 'Best', value: s.bestStreak, icon: Trophy, color: colors.warning },
          { label: 'Perfect days', value: s.perfectDays, icon: Sparkles, color: colors.arc },
        ].map(({ label, value, icon: Icon, color }) => (
          <View key={label} className="flex-1 bg-surface rounded-2xl p-3">
            <Icon size={18} color={color} />
            <CountUp value={value} className="font-display text-3xl text-foreground mt-1" />
            <Text variant="caption" muted>{label}</Text>
          </View>
        ))}
      </FadeIn>

      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-3">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      {!finished ? (
        <FadeIn index={2} className="bg-surface rounded-3xl px-4 py-2 mb-3">
          <View className="flex-row items-center justify-between mt-2">
            <Text variant="caption" muted className="uppercase tracking-wide">Today</Text>
            <Text variant="caption" style={{ color: colors.arc }}>{s.today?.done ?? 0}/{challenge.rules.length} done</Text>
          </View>
          {challenge.rules.map((id) => {
            const rule = ruleById(id)
            if (!rule) return null
            const row = todayRows.get(id)
            const done = row?.done ?? false
            const live = rule.kind === 'auto' && row?.target ? `${Math.round(row.value ?? 0).toLocaleString()} / ${Math.round(row.target).toLocaleString()}` : rule.hint
            return (
              <CheckRow
                key={id}
                label={rule.label}
                hint={live}
                done={done}
                auto={rule.kind === 'auto'}
                color={colors.arc}
                onPress={rule.kind === 'manual' ? () => toggleRule(id, today, !done) : undefined}
              />
            )
          })}
        </FadeIn>
      ) : null}

      <FadeIn index={3} className="bg-surface rounded-3xl p-4 mb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text variant="caption" muted className="uppercase tracking-wide">Your arc</Text>
          <Text variant="caption" muted>{s.completionPct}% of rules hit</Text>
        </View>
        <Heatmap start={challenge.start_date} end={challenge.end_date} days={dayMap} today={today} />
        <HeatLegend />
      </FadeIn>

      {challenge.start_weight_kg ? (
        <FadeIn index={4} className="bg-surface rounded-3xl p-4 mb-5">
          <Text variant="caption" muted className="uppercase tracking-wide mb-2">Start vs now</Text>
          <View className="flex-row gap-3">
            <Delta label="Weight" from={challenge.start_weight_kg} to={nowWeight} unit="kg" />
            {challenge.start_body_fat_pct ? <Delta label="Body fat" from={challenge.start_body_fat_pct} to={nowFat} unit="%" /> : null}
          </View>
          <Text variant="caption" muted className="mt-2">Scan your InBody every couple of weeks to keep this honest.</Text>
        </FadeIn>
      ) : null}

      <Button
        label="Leave the arc"
        variant="ghost"
        onPress={() => confirm('Leave the arc?', 'Your progress so far will stay in your history, but the arc ends now.', () => leave())}
      />
    </Screen>
  )
}

export default function ChallengeScreen() {
  const { challenge } = useChallengeStore()
  return challenge ? <ArcDashboard /> : <JoinView />
}
