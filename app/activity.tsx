import { useState } from 'react'
import { View } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { useActivityStore } from '../stores/activityStore'
import { ActivityType } from '../types'
import { Screen, Card, Chip, Input, Button, Heading, Text, EmptyState } from '../components/ui'
import {
  Footprints,
  Zap,
  Dumbbell,
  Bike,
  Droplets,
  Flower2,
  Ellipsis,
  Activity as ActivityIcon,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAutoRefresh } from '../lib/hooks/useAutoRefresh'

const TYPES: ActivityType[] = ['walk', 'run', 'gym', 'cycle', 'swim', 'yoga', 'other']

const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  walk: Footprints,
  run: Zap,
  gym: Dumbbell,
  cycle: Bike,
  swim: Droplets,
  yoga: Flower2,
  other: Ellipsis,
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function ActivityScreen() {
  const { user } = useAuthStore()
  const { todayActivity, fetchTodayActivity, addActivity, loading, error } = useActivityStore()
  const [type, setType] = useState<ActivityType>('walk')
  const [duration, setDuration] = useState('')
  const [steps, setSteps] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')

  const { refreshing, onRefresh } = useAutoRefresh(() => (user ? fetchTodayActivity(user.id) : undefined), { enabled: !!user })

  const handleSave = async () => {
    if (!user) return
    const result = await addActivity({
      user_id: user.id,
      activity_type: type,
      duration_min: parseInt(duration, 10) || 0,
      steps: parseInt(steps, 10) || 0,
      calories_burned: parseInt(calories, 10) || 0,
      notes,
    })
    if (result) { setDuration(''); setSteps(''); setCalories(''); setNotes('') }
  }

  return (
    <Screen back title="Log activity" scroll refreshing={refreshing} onRefresh={onRefresh}>
      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      <Text variant="label" className="mb-2">Type</Text>
      <View className="flex-row flex-wrap gap-2 mb-5">
        {TYPES.map((t) => (
          <Chip
            key={t}
            label={capitalize(t)}
            icon={TYPE_ICON[t]}
            selected={type === t}
            onPress={() => setType(t)}
          />
        ))}
      </View>

      <View className="gap-4 mb-5">
        <Input
          label="Duration (min)"
          keyboardType="number-pad"
          value={duration}
          onChangeText={setDuration}
          placeholder="0"
        />
        <Input
          label="Steps"
          keyboardType="number-pad"
          value={steps}
          onChangeText={setSteps}
          placeholder="0"
        />
        <Input
          label="Calories burned (kcal)"
          keyboardType="number-pad"
          value={calories}
          onChangeText={setCalories}
          placeholder="0"
        />
        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
        />
      </View>

      <Button label="Save activity" onPress={handleSave} loading={loading} className="mb-6" />

      <Heading level={4} uppercase className="mb-3">Today&apos;s activity</Heading>
      {todayActivity.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity logged yet"
          description="Log a walk, workout, or other activity to see it here."
        />
      ) : (
        <View className="gap-3">
          {todayActivity.map((a) => (
            <Card key={a.id}>
              <View className="flex-row justify-between items-start mb-1">
                <Text variant="label" className="capitalize">{a.activity_type}</Text>
                <Text className="font-display text-xl text-primary">{a.calories_burned} kcal</Text>
              </View>
              <Text variant="caption" muted>{a.duration_min} min · {a.steps} steps</Text>
              {a.notes ? <Text variant="caption" muted className="mt-1">{a.notes}</Text> : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  )
}
