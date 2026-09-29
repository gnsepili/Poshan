import { useEffect } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useHealthConnectStore } from '../stores/healthConnectStore'

export default function HealthConnectScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { available, permissionGranted, todaySteps, todayActiveCalories, syncing, error, lastSyncedAt, checkAvailability, requestPermissions, syncNow } =
    useHealthConnectStore()

  useEffect(() => { checkAvailability() }, [])

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">Health Connect</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}

      <View className="px-6 pt-4">
        {Platform.OS !== 'android' || available === false ? (
          <View className="bg-white rounded-xl p-4 border border-gray-100">
            <Text className="text-gray-800 font-semibold mb-1">Not available on this device</Text>
            <Text className="text-gray-500 text-sm">
              Health Connect is an Android feature. Install the Health Connect app (Android) to auto-sync steps, active
              calories, heart rate and workouts. You can keep logging activity manually in the meantime.
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-gray-600 mb-4">
              Sync steps, active calories, heart rate and workouts that Google Fit and other apps write into Health Connect.
            </Text>
            {!permissionGranted ? (
              <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-4" onPress={requestPermissions}>
                <Text className="text-white font-semibold text-base">Connect Health Connect</Text>
              </Pressable>
            ) : (
              <>
                <View className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
                  <Text className="text-gray-800 font-semibold mb-2">Today (from Health Connect)</Text>
                  <Text className="text-sm text-gray-600">Steps: {todaySteps}</Text>
                  <Text className="text-sm text-gray-600">Active calories: {todayActiveCalories} kcal</Text>
                  {lastSyncedAt ? <Text className="text-xs text-gray-400 mt-2">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</Text> : null}
                </View>
                <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-4" disabled={syncing} onPress={() => user && syncNow(user.id)}>
                  {syncing ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Sync now</Text>}
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}
