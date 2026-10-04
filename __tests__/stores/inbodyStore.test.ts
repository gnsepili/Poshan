import { useInbodyStore } from '../../stores/inbodyStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const mockInsert = (data: unknown, error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

const nullMetrics = {
  user_id: 'u1', photo_url: 'u1/scan.jpg',
  weight_kg: 72.5, body_fat_pct: null, muscle_mass_kg: null, visceral_fat: null, bmr: null,
  raw_extracted_json: { Weight: '72.5' }, ai_notes: 'ok',
}

describe('inbodyStore', () => {
  beforeEach(() => useInbodyStore.setState({ reports: [], latest: null, loading: false, error: null }))

  it('inserts null metrics unchanged (no fabrication to 0)', async () => {
    const chain = mockInsert({ id: 'r1', scanned_at: '2026-09-29T10:00:00Z', created_at: '2026-09-29T10:00:00Z', ...nullMetrics })
    await useInbodyStore.getState().addReport(nullMetrics)
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ body_fat_pct: null, muscle_mass_kg: null, bmr: null }))
    expect(useInbodyStore.getState().latest?.id).toBe('r1')
  })

  it('sets error on failed insert and returns null', async () => {
    mockInsert(null, { message: 'insert failed' })
    const result = await useInbodyStore.getState().addReport(nullMetrics)
    expect(result).toBeNull()
    expect(useInbodyStore.getState().error).toBe('insert failed')
  })

  it('keeps reports newest-first when a scan with an older printed date is added', async () => {
    useInbodyStore.setState({
      reports: [{ id: 'new', scanned_at: '2026-10-01T12:00:00Z' } as never],
      latest: { id: 'new', scanned_at: '2026-10-01T12:00:00Z' } as never,
    })
    mockInsert({ id: 'old', scanned_at: '2026-09-01T12:00:00Z', ...nullMetrics })
    await useInbodyStore.getState().addReport({ ...nullMetrics, scanned_at: '2026-09-01T12:00:00Z' })
    expect(useInbodyStore.getState().reports.map((r) => r.id)).toEqual(['new', 'old'])
    expect(useInbodyStore.getState().latest?.id).toBe('new')
  })

  it('updateReport replaces the report in place (re-reading an old scan in full)', async () => {
    useInbodyStore.setState({
      reports: [{ id: 'r1', scanned_at: '2026-10-01T12:00:00Z', extraction_version: 1 } as never],
    })
    const chain = { update: jest.fn(), eq: jest.fn(), select: jest.fn(), single: jest.fn() }
    chain.update.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.select.mockReturnValue(chain)
    chain.single.mockResolvedValue({ data: { id: 'r1', scanned_at: '2026-10-01T12:00:00Z', extraction_version: 2, bmi: 31.2 }, error: null })
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const updated = await useInbodyStore.getState().updateReport('r1', { extraction_version: 2, bmi: 31.2 })

    expect(chain.update).toHaveBeenCalledWith({ extraction_version: 2, bmi: 31.2 })
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1')
    expect(updated?.extraction_version).toBe(2)
    expect(useInbodyStore.getState().reports[0].extraction_version).toBe(2)
    expect(useInbodyStore.getState().latest?.id).toBe('r1')
  })
})
