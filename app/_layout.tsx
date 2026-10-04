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
import { useActivityStore } from '../stores/activityStore'
import { useDailySummaryStore } from '../stores/dailySummaryStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { usePlansStore } from '../stores/plansStore'
import { useChatStore } from '../stores/chatStore'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { logError } from '../lib/telemetry'
import { installGlobalErrorHandler } from '../lib/globalErrorHandler'
import { onboardingStatus, redirectFor } from '../lib/utils/onboarding'
import { whenHydrated } from '../lib/cacheHydration'

SplashScreen.preventAutoHideAsync().catch(() => {})
installGlobalErrorHandler()

export default function RootLayout() {
  const { session, user, initialize } = useAuthStore()
  const { profile, goals, fetchProfile, fetchGoals } = useProfileStore()
  const { registerForPush } = usePushStore()
  const { flushQueue, loadPendingCount } = useMealsStore()
  const [authReady, setAuthReady] = useState(false)
  const [cacheReady, setCacheReady] = useState(false)
  const [onboardingCheck, setOnboardingCheck] = useState({ checked: false, fetchFailed: false })
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

  // Cached data must be loaded before anything fetches fresh data over it.
  useEffect(() => {
    whenHydrated(
      [useMealsStore, useProfileStore, useActivityStore, useDailySummaryStore, useInbodyStore, usePlansStore, useChatStore],
      2000
    ).then(() => setCacheReady(true))
  }, [])

  useEffect(() => {
    let cleanupFn: (() => void) | undefined
    initialize()
      .then((fn) => {
        cleanupFn = fn
      })
      // A failed session restore must not leave the app on a blank screen forever:
      // fall through to the login screen instead.
      .catch((e) => logError('auth-initialize', e))
      .finally(() => setAuthReady(true))
    return () => cleanupFn?.()
  }, [])

  // Keyed on the user id (not the session object) so token refreshes don't re-run it.
  // checkAttempt re-runs it when a failed check is retried (see the AppState effect below).
  const userId = user?.id
  const [checkAttempt, setCheckAttempt] = useState(0)
  useEffect(() => {
    setOnboardingCheck({ checked: false, fetchFailed: false })
    if (!session || !userId || !cacheReady) return
    // Never judge this user by another user's profile/goals still in memory.
    const cached = useProfileStore.getState()
    if ((cached.profile && cached.profile.id !== userId) || (cached.goals && cached.goals.user_id !== userId)) {
      useProfileStore.setState({ profile: null, goals: null })
    }
    let cancelled = false
    Promise.all([fetchProfile(userId), fetchGoals(userId)])
      .then(([profileOk, goalsOk]) => {
        if (!cancelled) setOnboardingCheck({ checked: true, fetchFailed: !(profileOk && goalsOk) })
      })
      .catch(() => {
        if (!cancelled) setOnboardingCheck({ checked: true, fetchFailed: true })
      })
    return () => {
      cancelled = true
    }
  }, [!!session, userId, checkAttempt, cacheReady])

  useEffect(() => {
    if (session && userId) registerForPush(userId)
  }, [!!session, userId])

  // A failed check (e.g. offline launch) is retried when the app returns to the foreground,
  // so a new user isn't left outside onboarding until the next restart.
  useEffect(() => {
    if (!onboardingCheck.fetchFailed) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setCheckAttempt((n) => n + 1)
    })
    return () => sub.remove()
  }, [onboardingCheck.fetchFailed])

  useEffect(() => {
    if (!session || !userId) return
    const flush = () => flushQueue().catch((e) => logError('meal-queue-flush', e))
    loadPendingCount().catch((e) => logError('meal-queue-count', e))
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) flush()
    })
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') flush()
    })
    return () => {
      unsubscribeNet()
      sub.remove()
    }
  }, [!!session, userId])

  const status = onboardingStatus({
    ...onboardingCheck,
    hasProfile: !!profile,
    hasGoals: !!goals,
  })
  useEffect(() => {
    if (!authReady) return
    const target = redirectFor({ hasSession: !!session, status, group: segments[0] })
    if (target) router.replace(target as never)
  }, [session, status, authReady, segments])

  const appReady = fontsLoaded && authReady && cacheReady
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
