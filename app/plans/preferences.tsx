import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { usePlansStore } from '../../stores/plansStore'
import { defaultWorkoutPrefs, EQUIPMENT_LABEL, EXPERIENCE_LABEL, FOCUS_LABEL } from '../../lib/utils/workoutPrefs'
import { WorkoutEquipment, WorkoutExperience, WorkoutFocus, WorkoutPrefs } from '../../types'
import { Screen, Text, Button, Chip, Input } from '../../components/ui'

function Group<T extends string | number>({ label, options, value, onChange, format }: { label: string; options: T[]; value: T; onChange: (v: T) => void; format: (v: T) => string }) {
  return (
    <View className="mb-5">
      <Text variant="label" className="mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={String(o)} label={format(o)} selected={value === o} onPress={() => onChange(o)} />
        ))}
      </View>
    </View>
  )
}

// Training preferences that shape the generated workout plan.
export default function WorkoutPreferencesScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { profile, goals, upsertProfile, loading, error } = useProfileStore()
  const { generateWorkoutPlan } = usePlansStore()
  const [prefs, setPrefs] = useState<WorkoutPrefs>(profile?.workout_prefs ?? defaultWorkoutPrefs(goals?.goal_type))
  const set = <K extends keyof WorkoutPrefs>(key: K) => (v: WorkoutPrefs[K]) => setPrefs((p) => ({ ...p, [key]: v }))

  const save = async (rebuild: boolean) => {
    if (!user) return
    await upsertProfile({ id: user.id, workout_prefs: prefs })
    if (useProfileStore.getState().error) return
    router.back()
    if (rebuild) generateWorkoutPlan(user.id)
  }

  return (
    <Screen
      back
      title="Your training"
      scroll
      footer={
        <View className="flex-row gap-3">
          <View className="flex-1"><Button label="Save & rebuild plan" loading={loading} onPress={() => save(true)} /></View>
          <Button label="Save" variant="secondary" fullWidth={false} onPress={() => save(false)} />
        </View>
      }
    >
      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}
      <Group label="Training days a week" options={[2, 3, 4, 5, 6]} value={prefs.days_per_week} onChange={set('days_per_week')} format={(n) => `${n}`} />
      <Group label="Session length" options={[30, 45, 60, 90]} value={prefs.session_minutes} onChange={set('session_minutes')} format={(n) => `${n} min`} />
      <Group<WorkoutEquipment> label="Where you train" options={['gym', 'home_dumbbells', 'bodyweight']} value={prefs.equipment} onChange={set('equipment')} format={(v) => EQUIPMENT_LABEL[v]} />
      <Group<WorkoutFocus> label="Main focus" options={['fat_loss', 'muscle', 'strength', 'general', 'endurance']} value={prefs.focus} onChange={set('focus')} format={(v) => FOCUS_LABEL[v]} />
      <Group<WorkoutExperience> label="Experience" options={['beginner', 'intermediate', 'advanced']} value={prefs.experience} onChange={set('experience')} format={(v) => EXPERIENCE_LABEL[v]} />
      <Input
        label="Injuries or limitations (optional)"
        value={prefs.limitations}
        onChangeText={set('limitations')}
        placeholder="Left knee pain, no overhead pressing"
        multiline
      />
    </Screen>
  )
}
