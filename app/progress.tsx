import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { TrendingUp } from 'lucide-react-native'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { useDailySummaryStore } from '../stores/dailySummaryStore'
import { LineChart } from '../components/ui/LineChart'
import { BarChart } from '../components/ui/BarChart'
import { Screen, Card, Heading, Text, EmptyState } from '../components/ui'
import { useThemeColors } from '../lib/theme'
import { adherenceSeries } from '../lib/utils/chart'
import { InBodyReport } from '../types'

// Oldest-first series of a single metric, dropping scans where it was not read.
function series(reports: InBodyReport[], key: 'weight_kg' | 'body_fat_pct' | 'muscle_mass_kg') {
  return [...reports]
    .sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime())
    .filter((r) => r[key] !== null)
    .map((r) => ({ label: new Date(r.scanned_at).toLocaleDateString(), value: r[key] as number }))
}

export default function ProgressScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { reports, fetchReports, loading, error } = useInbodyStore()
  const { recent, fetchRecent, error: adherenceError } = useDailySummaryStore()

  useEffect(() => { if (user) { fetchReports(user.id); fetchRecent(user.id) } }, [user])

  const charts: { title: string; color: string; data: { label: string; value: number }[] }[] = [
    { title: 'Weight (kg)', color: colors.primary, data: series(reports, 'weight_kg') },
    { title: 'Body fat (%)', color: colors.accent, data: series(reports, 'body_fat_pct') },
    { title: 'Muscle mass (kg)', color: colors.info, data: series(reports, 'muscle_mass_kg') },
  ]

  const adherence = adherenceSeries(
    recent.map((r) => ({
      date: r.date,
      total_calories_consumed: r.total_calories_consumed,
      ai_daily_goals: r.ai_daily_goals ? { calories: r.ai_daily_goals.calories } : null,
    }))
  )

  const errorMessage = error ?? adherenceError

  return (
    <Screen back title="Body progress" scroll>
      {errorMessage ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{errorMessage}</Text>
        </View>
      ) : null}

      {loading ? <ActivityIndicator className="mt-8" color={colors.primary} /> : null}

      {!loading && reports.length < 2 ? (
        <EmptyState
          icon={TrendingUp}
          title="No data yet"
          description="Add at least 2 InBody scans to see your trends over time."
          actionLabel="Add a scan"
          onAction={() => router.push('/inbody')}
        />
      ) : null}

      {!loading && reports.length >= 2 ? (
        <View className="gap-4 mb-4">
          {charts.map((c) => (
            <Card key={c.title}>
              <Heading level={4} uppercase className="mb-3">{c.title}</Heading>
              <LineChart data={c.data} color={c.color} />
            </Card>
          ))}
        </View>
      ) : null}

      {!loading ? (
        <Card>
          <Heading level={4} uppercase className="mb-3">Calorie adherence (last 30 days)</Heading>
          {adherence.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No data yet" />
          ) : (
            <BarChart data={adherence} />
          )}
        </Card>
      ) : null}
    </Screen>
  )
}
