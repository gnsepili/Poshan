import { invokeEdgeFunction } from './edgeFunction'
import { DailySummary } from '../../types'

// User (lazy) mode: derive the user server-side from the JWT; never send a user_id.
export function generateDailySummary(): Promise<DailySummary | null> {
  return invokeEdgeFunction<DailySummary | null>('generate-daily-summary', undefined, { timeoutMs: 60_000 })
}
