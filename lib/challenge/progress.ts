// One row of challenge_progress(): a rule's status on a day (YYYY-MM-DD, UTC days).
export interface ArcRow {
  day: string
  rule_id: string
  done: boolean
  value: number | null
  target: number | null
}

export interface ArcDay {
  date: string
  done: number
  total: number
  complete: boolean
}

export interface ArcSummary {
  days: ArcDay[]
  /** Day of the arc (in strict mode, of the current run since the last restart). */
  dayNumber: number
  totalDays: number
  currentStreak: number
  bestStreak: number
  perfectDays: number
  /** Share of all rule-days completed so far, 0-100. */
  completionPct: number
  /** Strict mode: the date the current run started after a missed day, else null. */
  restartedOn: string | null
  today: ArcDay | null
}

const DAY_MS = 24 * 3600 * 1000
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
const addDays = (d: string, n: number) => new Date(toUtc(d) + n * DAY_MS).toISOString().split('T')[0]

export function summarizeArc(
  rows: ArcRow[],
  { startDate, endDate, strict, today }: { startDate: string; endDate: string; strict: boolean; today: string }
): ArcSummary {
  const byDay = new Map<string, ArcDay>()
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { date: r.day, done: 0, total: 0, complete: false }
    d.total += 1
    if (r.done) d.done += 1
    byDay.set(r.day, d)
  }
  const days = [...byDay.values()]
    .map((d) => ({ ...d, complete: d.total > 0 && d.done === d.total }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const todayRow = days.find((d) => d.date === today) ?? null
  // Today only counts once it's finished; an unfinished today never breaks anything.
  const settled = days.filter((d) => d.date < today || (d.date === today && d.complete))

  let best = 0
  let run = 0
  for (const d of settled) {
    run = d.complete ? run + 1 : 0
    best = Math.max(best, run)
  }

  let restartedOn: string | null = null
  if (strict) {
    const missed = settled.filter((d) => !d.complete && d.date < today).pop()
    if (missed) restartedOn = addDays(missed.date, 1)
  }
  const runStart = restartedOn ?? startDate
  const doneTotal = days.reduce((n, d) => n + d.done, 0)
  const possible = days.reduce((n, d) => n + d.total, 0)

  return {
    days,
    dayNumber: Math.max(1, daysBetween(runStart, today) + 1),
    totalDays: daysBetween(runStart, endDate) + 1,
    currentStreak: run,
    bestStreak: best,
    perfectDays: days.filter((d) => d.complete).length,
    completionPct: possible > 0 ? Math.round((doneTotal / possible) * 100) : 0,
    restartedOn,
    today: todayRow,
  }
}
