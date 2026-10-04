import { onboardingStatus, redirectFor } from '../../lib/utils/onboarding'

describe('onboardingStatus', () => {
  it('is unknown while the profile/goals check has not finished', () => {
    expect(onboardingStatus({ checked: false, fetchFailed: false, hasProfile: false, hasGoals: false })).toBe('unknown')
  })
  it('is unavailable (not "needs onboarding") when the check failed, e.g. an offline launch', () => {
    expect(onboardingStatus({ checked: true, fetchFailed: true, hasProfile: false, hasGoals: false })).toBe('unavailable')
  })
  it('needs a profile first, then goals', () => {
    expect(onboardingStatus({ checked: true, fetchFailed: false, hasProfile: false, hasGoals: false })).toBe('needs_profile')
    expect(onboardingStatus({ checked: true, fetchFailed: false, hasProfile: true, hasGoals: false })).toBe('needs_goals')
  })
  it('is complete with both a profile and goals', () => {
    expect(onboardingStatus({ checked: true, fetchFailed: false, hasProfile: true, hasGoals: true })).toBe('complete')
  })
})

describe('redirectFor', () => {
  it('sends signed-out users to login, wherever they are', () => {
    expect(redirectFor({ hasSession: false, status: 'unknown', group: '(tabs)' })).toBe('/(auth)/login')
    expect(redirectFor({ hasSession: false, status: 'unknown', group: '(auth)' })).toBeNull()
  })

  it('keeps a user inside onboarding after step 1 creates their profile (the old skip bug)', () => {
    expect(redirectFor({ hasSession: true, status: 'needs_goals', group: '(onboarding)' })).toBeNull()
  })

  it('sends an incomplete user into the right onboarding step', () => {
    expect(redirectFor({ hasSession: true, status: 'needs_profile', group: '(tabs)' })).toBe('/(onboarding)/profile')
    expect(redirectFor({ hasSession: true, status: 'needs_goals', group: '(tabs)' })).toBe('/(onboarding)/goals')
    expect(redirectFor({ hasSession: true, status: 'needs_goals', group: '(auth)' })).toBe('/(onboarding)/goals')
  })

  it('lets a fully onboarded user open the profile/goals screens from Settings (no bounce home)', () => {
    expect(redirectFor({ hasSession: true, status: 'complete', group: '(onboarding)' })).toBeNull()
  })

  it('moves a signed-in user off the auth screens once onboarding state is known', () => {
    expect(redirectFor({ hasSession: true, status: 'complete', group: '(auth)' })).toBe('/(tabs)')
    expect(redirectFor({ hasSession: true, status: 'unknown', group: '(auth)' })).toBeNull()
  })

  it('never forces onboarding when the state could not be loaded, but still leaves the auth screens', () => {
    expect(redirectFor({ hasSession: true, status: 'unavailable', group: '(tabs)' })).toBeNull()
    expect(redirectFor({ hasSession: true, status: 'unavailable', group: '(auth)' })).toBe('/(tabs)')
  })

  it('leaves everything else alone', () => {
    expect(redirectFor({ hasSession: true, status: 'complete', group: '(tabs)' })).toBeNull()
    expect(redirectFor({ hasSession: true, status: 'complete', group: 'inbody' })).toBeNull()
  })
})
