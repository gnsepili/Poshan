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
})
