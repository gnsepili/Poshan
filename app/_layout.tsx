import '../global.css'
import { useCallback, useEffect, useState } from 'react'
import { AppState, useColorScheme as useSystemColorScheme } from 'react-native'
import { useColorScheme as useNativewindColorScheme } from 'nativewind'
import NetInfo from '@react-native-community/netinfo'
import { Stack, useRouter, useSegments } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow'
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed'
import { useAuthStore } from '../stores/authStore'
import { useProfileStore } from '../stores/profileStore'
import { usePushStore } from '../stores/pushStore'
import { useMealsStore } from '../stores/mealsStore'
import { ErrorBoundary } from '../components/ErrorBoundary'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const { session, user, initialize } = useAuthStore()
  const { profile, fetchProfile } = useProfileStore()
  const { registerForPush } = usePushStore()
  const { flushQueue, loadPendingCount } = useMealsStore()
  const [authReady, setAuthReady] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const router = useRouter()
  const segments = useSegments()
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  })

  // Mirror the OS color scheme into NativeWind (class strategy) so light/dark
  // tokens switch with the system setting.
  const systemScheme = useSystemColorScheme()
  const { setColorScheme } = useNativewindColorScheme()
  useEffect(() => {
    setColorScheme(systemScheme === 'dark' ? 'dark' : 'light')
  }, [systemScheme, setColorScheme])

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
      registerForPush(user.id)
    } else {
      setProfileChecked(false)
    }
  }, [session, user])

  useEffect(() => {
    if (!session || !user) return
    loadPendingCount()
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) flushQueue()
    })
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') flushQueue()
    })
    return () => {
      unsubscribeNet()
      sub.remove()
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

  const appReady = fontsLoaded && authReady
  const onLayoutRootView = useCallback(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {})
  }, [appReady])

  if (!appReady) return null

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
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
    </ErrorBoundary>
  )
}
