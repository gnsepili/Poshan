import { useEffect } from 'react'
import { View, Platform } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { useHealthConnectStore } from '../stores/healthConnectStore'
import { Screen, Card, Button, Badge, EmptyState, Heading, Text } from '../components/ui'
import { useThemeColors } from '../lib/theme'
import { HeartPulse, Footprints, Flame, Watch } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

export default function HealthConnectScreen() {
  const { user } = useAuthStore()
  const colors = useThemeColors()
  const {
    available,
    permissionGranted,
    todaySteps,
    todayActiveCalories,
    todayHeartRate,
    syncing,
    error,
    lastSyncedAt,
    checkAvailability,
    requestPermissions,
    syncNow,
  } = useHealthConnectStore()

  useEffect(() => { checkAvailability() }, [])

  const unavailable = Platform.OS !== 'android' || available === false

  return (
    <Screen back title="Health Connect" scroll>
      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      {unavailable ? (
        <EmptyState
          icon={Watch}
          title="Not available on this device"
          description="Health Connect is an Android feature. Install the Health Connect app to auto-sync steps, active calories, heart rate and workouts. You can keep logging activity manually in the meantime."
        />
      ) : (
        <>
          <View className="flex-row items-start justify-between gap-3 mb-5">
            <Text variant="bodySm" muted className="flex-1">
              Sync steps, active calories, heart rate and workouts that Google Fit and other apps
              write into Health Connect.
            </Text>
            <Badge
              label={permissionGranted ? 'Connected' : 'Not connected'}
              tone={permissionGranted ? 'primary' : 'neutral'}
            />
          </View>

          {!permissionGranted ? (
            <Button label="Connect Health Connect" onPress={requestPermissions} />
          ) : (
            <>
              <Heading level={4} uppercase className="mb-3">Today</Heading>
              <View className="flex-row gap-3 mb-2">
                <StatCard icon={Footprints} label="Steps" value={`${todaySteps}`} color={colors.primary} />
                <StatCard icon={Flame} label="Active cal" value={`${todayActiveCalories}`} color={colors.accent} />
                <StatCard
                  icon={HeartPulse}
                  label="Heart rate"
                  value={todayHeartRate != null ? `${todayHeartRate}` : '—'}
                  color={colors.info}
                />
              </View>
              {lastSyncedAt ? (
                <Text variant="caption" muted className="mb-4">
                  Last synced {new Date(lastSyncedAt).toLocaleTimeString()}
                </Text>
              ) : (
                <View className="mb-4" />
              )}
              <Button
                label="Sync now"
                variant="accent"
                loading={syncing}
                onPress={() => user && syncNow(user.id)}
              />
            </>
          )}
        </>
      )}
    </Screen>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="flex-1 items-center py-4">
      <Icon size={20} color={color} />
      <Text className="font-display text-2xl text-foreground mt-1">{value}</Text>
      <Text variant="caption" muted>{label}</Text>
    </Card>
  )
}
