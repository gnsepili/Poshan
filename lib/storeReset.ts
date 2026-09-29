import { useMealsStore } from '../stores/mealsStore'
import { useActivityStore } from '../stores/activityStore'
import { useDailySummaryStore } from '../stores/dailySummaryStore'
import { usePlansStore } from '../stores/plansStore'
import { useProfileStore } from '../stores/profileStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { useChatStore } from '../stores/chatStore'
import { usePushStore } from '../stores/pushStore'
import { useHealthConnectStore } from '../stores/healthConnectStore'

// Wipe every per-user data store on sign-out so a second user on the same device
// never sees the previous user's cached data (Review Focus #5). authStore resets itself.
export function resetAllStores(): void {
  useMealsStore.setState({ meals: [], loading: false, error: null, pendingCount: 0, flushing: false })
  useActivityStore.setState({ todayActivity: [], loading: false, error: null })
  useDailySummaryStore.setState({ summary: null, recent: [], loading: false, loaded: false, error: null })
  usePlansStore.setState({ mealPlan: null, workoutPlan: null, loading: false, generating: false, error: null })
  useProfileStore.setState({ profile: null, goals: null, loading: false, error: null })
  useInbodyStore.setState({ reports: [], latest: null, loading: false, error: null })
  useChatStore.setState({ messages: [], conversationId: null, loading: false, error: null })
  usePushStore.setState({ token: null, permissionGranted: false, registering: false, error: null })
  useHealthConnectStore.setState({
    available: null,
    permissionGranted: false,
    todaySteps: 0,
    todayActiveCalories: 0,
    syncing: false,
    error: null,
    lastSyncedAt: null,
  })
}
