export type RuleKind = 'auto' | 'manual'

export interface ChallengeRule {
  id: string
  label: string
  hint: string
  /** auto = checked from logged meals/activity on the server; manual = daily tick-box. */
  kind: RuleKind
}

// Ids are shared with the challenge_progress() SQL function (auto rules).
export const RULES: ChallengeRule[] = [
  { id: 'workout', label: 'Train', hint: 'Log a workout (30+ min walks count)', kind: 'auto' },
  { id: 'steps', label: 'Hit your steps', hint: 'Your daily steps target', kind: 'auto' },
  { id: 'protein', label: 'Hit your protein', hint: 'Your daily protein target', kind: 'auto' },
  { id: 'calories', label: 'Calories on target', hint: '80–105% of your calorie target', kind: 'auto' },
  { id: 'log_meals', label: 'Log every meal', hint: '3 or more meals logged', kind: 'auto' },
  { id: 'no_junk', label: 'No junk food', hint: 'No fast food, sweets or sugary drinks', kind: 'manual' },
  { id: 'no_alcohol', label: 'No alcohol', hint: 'Not a drop', kind: 'manual' },
  { id: 'water', label: 'Drink 3 L water', hint: 'About 12 glasses', kind: 'manual' },
  { id: 'sleep', label: 'Sleep 7+ hours', hint: 'Same bedtime every night', kind: 'manual' },
  { id: 'wake_early', label: 'Wake up early', hint: 'Before 6:30 am', kind: 'manual' },
  { id: 'read', label: 'Read 10 pages', hint: 'Something that makes you better', kind: 'manual' },
  { id: 'no_doomscroll', label: 'No doomscrolling', hint: 'Under 1 hour of social media', kind: 'manual' },
  { id: 'cold_shower', label: 'Cold shower', hint: 'At least 1 minute', kind: 'manual' },
  { id: 'journal', label: 'Journal', hint: 'Plan the day or reflect on it', kind: 'manual' },
]

export const CLASSIC_RULES = ['workout', 'steps', 'protein', 'no_junk', 'no_alcohol', 'water', 'sleep', 'read']

export const ruleById = (id: string): ChallengeRule | undefined => RULES.find((r) => r.id === id)

const iso = (d: Date) => d.toISOString().split('T')[0]

// Joining in Oct-Dec runs the Winter Arc to Dec 31; any other time it's a 90-day arc.
export function arcWindow(now: Date = new Date()): { startDate: string; endDate: string; title: string } {
  const year = now.getUTCFullYear()
  const startDate = iso(now)
  if (now.getUTCMonth() >= 9) return { startDate, endDate: `${year}-12-31`, title: `Winter Arc ${year}` }
  const end = new Date(now.getTime() + 89 * 24 * 3600 * 1000)
  return { startDate, endDate: iso(end), title: '90-day arc' }
}
