import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMealsStore, QUEUE_KEY } from '../stores/mealsStore'
import { useActivityStore } from '../stores/activityStore'
import { useDailySummaryStore } from '../stores/dailySummaryStore'
import { usePlansStore } from '../stores/plansStore'
import { useProfileStore } from '../stores/profileStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { useChatStore } from '../stores/chatStore'
import { usePushStore } from '../stores/pushStore'
import { useHealthConnectStore } from '../stores/healthConnectStore'
import { clearSignedPhotoCache } from './signedPhotos'

// Wipe every per-user data store on sign-out so a second user on the same device
// never sees the previous user's cached data (Review Focus #5). authStore resets itself.
export async function resetAllStores(): Promise<void> {
  clearSignedPhotoCache()
  useMealsStore.setState({ meals: [], mealsDay: null, loading: false, error: null, pendingCount: 0, flushing: false })
  useActivityStore.setState({ todayActivity: [], activityDay: null, loading: false, error: null })
  useDailySummaryStore.setState({ summary: null, summaryDay: null, recent: [], loading: false, loaded: false, error: null })
  usePlansStore.setState({ mealPlan: null, workoutPlan: null, loading: false, generating: false, workoutBusy: null, error: null })
  useProfileStore.setState({ profile: null, goals: null, loading: false, error: null })
  useInbodyStore.setState({ reports: [], latest: null, loading: false, error: null })
  useChatStore.setState({ messages: [], conversationId: null, conversations: [], loading: false, error: null })
  usePushStore.setState({ token: null, permissionGranted: false, registering: false, error: null })
  useHealthConnectStore.setState({
    available: null,
    permissionGranted: false,
    todaySteps: 0,
    todayActiveCalories: 0,
    todayHeartRate: null,
    syncing: false,
    error: null,
    lastSyncedAt: null,
  })

  // Best-effort: also purge the persisted offline meal queue so a second user on a shared
  // device never inherits (and stalls a flush on) the previous user's queued meals — RLS
  // would reject rows written under user A's ids once user B is signed in (Review Focus #6).
  // A removeItem failure here must never throw/block sign-out.
  try {
    await AsyncStorage.removeItem(QUEUE_KEY)
  } catch {
    // ignore — best-effort purge only
  }
}
