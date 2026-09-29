import { analyzeInBodyPhoto } from '../../lib/api/inbody'

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) } },
}))

describe('analyzeInBodyPhoto', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  it('passes null metrics through unchanged', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ weight_kg: 72.5, body_fat_pct: null, muscle_mass_kg: null, visceral_fat: 8, bmr: null, raw: { Weight: '72.5' }, notes: 'nice' }),
    }) as unknown as typeof fetch
    const result = await analyzeInBodyPhoto('u1/scan.jpg')
    expect(result.weight_kg).toBe(72.5)
    expect(result.body_fat_pct).toBeNull()
    expect(result.muscle_mass_kg).toBeNull()
    expect(result.bmr).toBeNull()
  })

  it('throws with the server error message on non-ok', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'bad photo' }) }) as unknown as typeof fetch
    await expect(analyzeInBodyPhoto('u1/scan.jpg')).rejects.toThrow('bad photo')
  })
})
