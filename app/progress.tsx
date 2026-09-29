import { useEffect } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { LineChart } from '../components/ui/LineChart'
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
  const { user } = useAuthStore()
  const { reports, fetchReports, loading, error } = useInbodyStore()

  useEffect(() => { if (user) fetchReports(user.id) }, [user])

  const charts: { title: string; color: string; data: { label: string; value: number }[] }[] = [
    { title: 'Weight (kg)', color: '#16a34a', data: series(reports, 'weight_kg') },
    { title: 'Body fat (%)', color: '#dc2626', data: series(reports, 'body_fat_pct') },
    { title: 'Muscle mass (kg)', color: '#2563eb', data: series(reports, 'muscle_mass_kg') },
  ]

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">Body progress</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}
      {loading && <ActivityIndicator className="mt-8" color="#16a34a" />}

      {!loading && reports.length < 2 ? (
        <View className="flex-1 items-center justify-center px-8 py-20">
          <Text className="text-gray-400 text-center">Add at least 2 InBody scans to see your trends over time.</Text>
          <Pressable className="bg-green-600 rounded-lg py-3 px-6 mt-4" onPress={() => router.push('/inbody')}>
            <Text className="text-white font-semibold">Add a scan</Text>
          </Pressable>
        </View>
      ) : (
        <View className="px-6 pt-4">
          {charts.map((c) => (
            <View key={c.title} className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
              <Text className="font-semibold text-gray-700 mb-2">{c.title}</Text>
              <LineChart data={c.data} color={c.color} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
