import { Image, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, HeartPulse, LogOut, Scale, Target, TrendingUp, UserRound } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { useInbodyStore } from '../../stores/inbodyStore'
import { useAutoRefresh } from '../../lib/hooks/useAutoRefresh'
import { useThemeColors } from '../../lib/theme'
import { Screen, Heading, Text, Button } from '../../components/ui'
import { FadeIn, PressableScale } from '../../components/motion'

const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very active',
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-3">
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
      <Text className="font-display text-2xl text-foreground">{value}</Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text variant="bodySm" muted>
        {label}
      </Text>
      <Text variant="bodySm" className="font-semibold">
        {value}
      </Text>
    </View>
  )
}

function Section({ icon: Icon, title, color, action, onPress, children }: { icon: LucideIcon; title: string; color: string; action: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <PressableScale className="bg-surface rounded-2xl p-4" onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}: ${action}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <Icon size={20} color={color} />
          <Text variant="label">{title}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text variant="caption" muted>
            {action}
          </Text>
          <ChevronRight size={18} color="#9A9AA0" />
        </View>
      </View>
      {children ? <View className="mt-2">{children}</View> : null}
    </PressableScale>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user, signOut, loading: authLoading, error: authError } = useAuthStore()
  const { profile, goals } = useProfileStore()
  const { latest, fetchReports } = useInbodyStore()
  const { refreshing, onRefresh } = useAutoRefresh(() => (user ? fetchReports(user.id) : undefined), { enabled: !!user })

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string }
  const name = meta.full_name ?? meta.name ?? user?.email?.split('@')[0] ?? 'You'
  const avatar = meta.avatar_url ?? meta.picture ?? null
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const weight = latest?.weight_kg ?? profile?.current_weight_kg ?? null
  const bmi =
    latest?.bmi ??
    (profile?.height_cm && weight ? Math.round((weight / Math.pow(profile.height_cm / 100, 2)) * 10) / 10 : null)

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <FadeIn index={0} className="items-center mt-4 mb-6">
        {avatar ? (
          <Image source={{ uri: avatar }} className="h-24 w-24 rounded-full bg-surface-muted" />
        ) : (
          <View className="h-24 w-24 rounded-full items-center justify-center" style={{ backgroundColor: colors.primarySoft }}>
            <Text className="font-display text-4xl" style={{ color: colors.primary }}>
              {initials}
            </Text>
          </View>
        )}
        <Heading level={2} className="mt-3">
          {name}
        </Heading>
        {user?.email ? (
          <Text variant="bodySm" muted>
            {user.email}
          </Text>
        ) : null}
      </FadeIn>

      {authError ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {authError}
          </Text>
        </View>
      ) : null}

      <FadeIn index={1} className="flex-row gap-2.5 mb-3">
        <Stat label="Weight" value={weight ? `${weight} kg` : '—'} color={colors.macroCalories} />
        <Stat label="Target" value={goals?.target_weight_kg ? `${goals.target_weight_kg} kg` : '—'} color={colors.macroProtein} />
        <Stat label="BMI" value={bmi ? String(bmi) : '—'} color={colors.macroCarbs} />
      </FadeIn>

      <View className="gap-3 mb-6">
        <FadeIn index={2}>
          <Section icon={UserRound} title="Health profile" color={colors.macroFat} action="Edit" onPress={() => router.push('/(onboarding)/profile?mode=edit')}>
            {profile ? (
              <>
                <Row label="Age" value={`${profile.age}`} />
                <Row label="Sex" value={profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)} />
                <Row label="Height" value={`${profile.height_cm} cm`} />
                <Row label="Activity" value={ACTIVITY_LABEL[profile.activity_level] ?? profile.activity_level} />
              </>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section icon={Target} title="Goals" color={colors.macroProtein} action="Edit" onPress={() => router.push('/(onboarding)/goals?mode=edit')}>
            {goals ? (
              <>
                <Row label="Calories" value={`${goals.daily_calorie_target} kcal`} />
                <Row label="Protein · Carbs · Fat" value={`${goals.daily_protein_g} · ${goals.daily_carbs_g} · ${goals.daily_fat_g} g`} />
                <Row label="Steps" value={goals.daily_steps_target.toLocaleString()} />
              </>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section icon={Scale} title="Body composition" color={colors.macroCarbs} action={latest ? 'View' : 'Add scan'} onPress={() => router.push('/inbody')}>
            {latest ? (
              <>
                <Row label="Last scan" value={new Date(latest.scanned_at).toLocaleDateString()} />
                {latest.inbody_score !== null ? <Row label="InBody score" value={`${latest.inbody_score}`} /> : null}
                {latest.body_fat_pct !== null ? <Row label="Body fat" value={`${latest.body_fat_pct}%`} /> : null}
                {latest.muscle_mass_kg !== null ? <Row label="Skeletal muscle" value={`${latest.muscle_mass_kg} kg`} /> : null}
              </>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section icon={TrendingUp} title="Progress" color={colors.macroSteps} action="View" onPress={() => router.push('/progress')} />
        </FadeIn>

        <FadeIn index={6}>
          <Section icon={HeartPulse} title="Health Connect" color={colors.danger} action="Manage" onPress={() => router.push('/health-connect')} />
        </FadeIn>
      </View>

      <Button label="Sign out" variant="danger" icon={LogOut} loading={authLoading} onPress={signOut} />
    </Screen>
  )
}
