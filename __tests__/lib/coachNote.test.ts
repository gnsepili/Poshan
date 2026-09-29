import { shouldGenerateCoachNote, shouldGenerateAfterLoad, shouldShowLowFuelPrompt } from '../../lib/utils/coachNote'
import { DailySummary } from '../../types'

const summary = (note: string | null): DailySummary => ({
  id: 's', user_id: 'u', date: '2026-09-29', total_calories_consumed: 0, total_protein_g: 0,
  total_carbs_g: 0, total_fat_g: 0, total_steps: 0, weight_kg: null,
  ai_daily_goals: null, ai_coach_note: note, created_at: '2026-09-29T00:00:00Z',
})

describe('shouldGenerateCoachNote', () => {
  it('fires when the note is null and no attempt was made today', () => {
    expect(shouldGenerateCoachNote(summary(null), null, '2026-09-29')).toBe(true)
  })
  it('fires when there is no summary row at all', () => {
    expect(shouldGenerateCoachNote(null, null, '2026-09-29')).toBe(true)
  })
  it('does NOT fire again once attempted today, even while the note is still null', () => {
    expect(shouldGenerateCoachNote(summary(null), '2026-09-29', '2026-09-29')).toBe(false)
  })
  it('does NOT fire when a note already exists', () => {
    expect(shouldGenerateCoachNote(summary('good morning'), null, '2026-09-29')).toBe(false)
  })
})

describe('shouldGenerateAfterLoad', () => {
  it('does NOT fire while today\'s row has not finished loading, even if summary is still null', () => {
    expect(shouldGenerateAfterLoad(false, null, null, '2026-09-29')).toBe(false)
  })
  it('does NOT fire once loaded when the loaded row already has a coach note', () => {
    expect(shouldGenerateAfterLoad(true, summary('good morning'), null, '2026-09-29')).toBe(false)
  })
  it('fires once loaded when there is no row at all', () => {
    expect(shouldGenerateAfterLoad(true, null, null, '2026-09-29')).toBe(true)
  })
  it('fires once loaded when the row exists but has no coach note yet', () => {
    expect(shouldGenerateAfterLoad(true, summary(null), null, '2026-09-29')).toBe(true)
  })
  it('does NOT fire again once already attempted today', () => {
    expect(shouldGenerateAfterLoad(true, summary(null), '2026-09-29', '2026-09-29')).toBe(false)
  })
})

describe('shouldShowLowFuelPrompt', () => {
  it('shows in the afternoon when calories are well under target', () => {
    expect(shouldShowLowFuelPrompt(800, 2000, new Date('2026-09-29T16:00:00'))).toBe(true)
  })
  it('stays hidden in the morning even when calories are low', () => {
    expect(shouldShowLowFuelPrompt(0, 2000, new Date('2026-09-29T08:00:00'))).toBe(false)
  })
  it('stays hidden once calories reach 80% of target', () => {
    expect(shouldShowLowFuelPrompt(1700, 2000, new Date('2026-09-29T18:00:00'))).toBe(false)
  })
  it('never divides by a zero target', () => {
    expect(shouldShowLowFuelPrompt(0, 0, new Date('2026-09-29T18:00:00'))).toBe(false)
  })
})
