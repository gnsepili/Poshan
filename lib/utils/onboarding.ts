// Where a signed-in user stands in onboarding. 'unavailable' means the profile/goals
// check failed (e.g. offline launch) — never treat that as "needs onboarding", or an
// existing user would be pushed into the setup screens and overwrite their profile.
export type OnboardingStatus = 'unknown' | 'unavailable' | 'needs_profile' | 'needs_goals' | 'complete'

export function onboardingStatus(input: {
  checked: boolean
  fetchFailed: boolean
  hasProfile: boolean
  hasGoals: boolean
}): OnboardingStatus {
  if (!input.checked) return 'unknown'
  if (input.fetchFailed) return 'unavailable'
  if (!input.hasProfile) return 'needs_profile'
  if (!input.hasGoals) return 'needs_goals'
  return 'complete'
}

// The route guard. Only ever pushes users INTO onboarding (when incomplete) — never out
// of it, so the onboarding screens can move forward themselves and Settings can reuse
// them as edit screens.
export function redirectFor(input: { hasSession: boolean; status: OnboardingStatus; group: string | undefined }): string | null {
  const { hasSession, status, group } = input
  if (!hasSession) return group === '(auth)' ? null : '/(auth)/login'
  if (status === 'needs_profile') return group === '(onboarding)' ? null : '/(onboarding)/profile'
  if (status === 'needs_goals') return group === '(onboarding)' ? null : '/(onboarding)/goals'
  if ((status === 'complete' || status === 'unavailable') && group === '(auth)') return '/(tabs)'
  return null
}
