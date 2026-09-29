import { buildPushTokenRow } from '../../lib/utils/pushToken'

describe('buildPushTokenRow', () => {
  it('builds a row for a valid Expo push token', () => {
    expect(buildPushTokenRow('u1', 'ExponentPushToken[abc123]', 'android')).toEqual({
      user_id: 'u1', token: 'ExponentPushToken[abc123]', platform: 'android',
    })
  })
  it('accepts the ExpoPushToken[...] variant and trims whitespace', () => {
    expect(buildPushTokenRow('u1', '  ExpoPushToken[xyz]  ', 'ios')).toEqual({
      user_id: 'u1', token: 'ExpoPushToken[xyz]', platform: 'ios',
    })
  })
  it('returns null for an empty or garbage token', () => {
    expect(buildPushTokenRow('u1', '', 'android')).toBeNull()
    expect(buildPushTokenRow('u1', 'not-a-token', 'android')).toBeNull()
  })
})
