import { PushPlatform } from '../../types'

export interface PushTokenRow {
  user_id: string
  token: string
  platform: PushPlatform
}

// Normalise a token registration into the row we upsert. Rejects empty/garbage so a
// bad token can never be stored (dup/stale guard part 1; the unique index handles dups).
export function buildPushTokenRow(userId: string, token: string, platform: PushPlatform): PushTokenRow | null {
  const t = token.trim()
  if (!t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken[')) return null
  return { user_id: userId, token: t, platform }
}
