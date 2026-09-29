export const AI_LIMIT_MESSAGE = "You've reached today's AI limit. It resets at midnight."

// The daily-cap rule, expressed purely: the (cap)-th call is allowed, the (cap+1)-th
// denied. The DB RPC applies exactly this arithmetic atomically per (user_id, date),
// so the count resets each calendar day (Review Focus #2).
export function evaluateUsage(existingCount: number | null, cap: number): { allowed: boolean; nextCount: number } {
  const nextCount = (existingCount ?? 0) + 1
  return { allowed: nextCount <= cap, nextCount }
}

// Clients call this so a 429 always surfaces the friendly limit message.
export function messageForStatus(status: number, fallback: string): string {
  return status === 429 ? AI_LIMIT_MESSAGE : fallback
}
