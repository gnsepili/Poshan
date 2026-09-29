import '../global.css'
import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'

export default function RootLayout() {
  const { session, user, initialize } = useAuthStore()
  const { profile, fetchProfile } = useProfileStore()
  const [authReady, setAuthReady] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    let cleanupFn: (() => void) | undefined
    initialize().then((fn) => {
      cleanupFn = fn
      setAuthReady(true)
    })
    return () => cleanupFn?.()
  }, [])

  useEffect(() => {
    if (session && user) {
      fetchProfile(user.id).finally(() => setProfileChecked(true))
    } else {
      setProfileChecked(false)
    }
  }, [session, user])

  useEffect(() => {
    if (!authReady) return
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login')
      return
    }

    if (!profileChecked) return

    if (!profile) {
      if (!inOnboarding) router.replace('/(onboarding)/profile')
    } else if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)')
    }
  }, [session, profile, profileChecked, authReady, segments])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="inbody" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="progress" />
          <Stack.Screen name="health-connect" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
