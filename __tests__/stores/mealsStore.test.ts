import { useMealsStore } from '../../stores/mealsStore'
import { supabase } from '../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), storage: { from: jest.fn() } } }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'client-uuid-1' }))
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64data'),
  EncodingType: { Base64: 'base64' },
}))

const mockInsertResult = (error: unknown = null, status = error ? 400 : 201) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: error ? null : { id: 'meal-1' }, error, status })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('mealsStore', () => {
  beforeEach(() => {
    useMealsStore.setState({ meals: [], loading: false, error: null, pendingCount: 0, flushing: false })
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
  })

  it('sets error and reports failure on a failed (non-network) insert', async () => {
    mockInsertResult({ message: 'insert failed' })
    const res = await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
    expect(res).toEqual({ status: 'failed', error: 'insert failed' })
    expect(useMealsStore.getState().error).toBe('insert failed')
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  })

  it('reports a saved meal and uses a client-generated id without a global crypto object', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true })
    try {
      const chain = mockInsertResult()
      const res = await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
      expect(res.status).toBe('saved')
      expect(chain.insert.mock.calls[0][0].id).toBe('client-uuid-1')
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true, writable: true })
    }
  })

  it('queues the meal offline when supabase reports a network failure (status 0, resolved — not thrown)', async () => {
    // postgrest-js never rejects on a dropped connection: it resolves { error, status: 0 }.
    mockInsertResult({ message: 'TypeError: Network request failed', code: '' }, 0)
    const res = await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
    expect(res).toEqual({ status: 'queued' })
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])
    expect(written).toHaveLength(1)
    expect(written[0].id).toBe('client-uuid-1')
    expect(useMealsStore.getState().pendingCount).toBe(1)
    expect(useMealsStore.getState().error).toBeNull()
  })

  it('keeps an already-uploaded photo and the AI suggestion when a photo meal is queued offline', async () => {
    mockInsertResult({ message: 'TypeError: Network request failed', code: '' }, 0)
    await useMealsStore.getState().addMeal({
      user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2,
      photo_url: 'https://x.supabase.co/storage/v1/object/public/meal-photos/u1/1.jpg', ai_suggestions: 'Add greens',
    })
    const [queued] = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])
    expect(queued.photo_url).toBe('https://x.supabase.co/storage/v1/object/public/meal-photos/u1/1.jpg')
    expect(queued.photo_local_uri).toBeUndefined()
    expect(queued.ai_suggestions).toBe('Add greens')
  })

  it('reports failure (not a stuck spinner) when queueing offline itself fails', async () => {
    mockInsertResult({ message: 'TypeError: Network request failed', code: '' }, 0)
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('disk full'))
    const res = await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
    expect(res.status).toBe('failed')
    expect(useMealsStore.getState().loading).toBe(false)
  })

  it('queues the meal offline when the insert throws (no connectivity)', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
    chain.insert.mockReturnValue(chain)
    chain.select.mockReturnValue(chain)
    chain.single.mockRejectedValue(new Error('Network request failed'))
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const res = await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })

    expect(res).toEqual({ status: 'queued' })
    expect(AsyncStorage.setItem).toHaveBeenCalled()
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])
    expect(written).toHaveLength(1)
    expect(useMealsStore.getState().pendingCount).toBe(1)
    expect(useMealsStore.getState().error).toBeNull()
  })

  it('flushQueue inserts each queued meal exactly once, in order, then clears', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
      { id: 'b', user_id: 'u1', meal_type: 'dinner', description: 'b', total_calories: 2, protein_g: 2, carbs_g: 2, fat_g: 2, fiber_g: 0, queued_at: 't2' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    expect(insert).toHaveBeenCalledTimes(2)
    expect((insert.mock.calls[0][0] as { id: string }).id).toBe('a')
    expect((insert.mock.calls[1][0] as { id: string }).id).toBe('b')
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite)).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it('flushQueue stops on a real failure and keeps the remaining meals (no loss, no double-insert)', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
      { id: 'b', user_id: 'u1', meal_type: 'dinner', description: 'b', total_calories: 2, protein_g: 2, carbs_g: 2, fat_g: 2, fiber_g: 0, queued_at: 't2' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'server 500' } })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    expect(insert).toHaveBeenCalledTimes(2)
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite).map((m: { id: string }) => m.id)).toEqual(['b'])
    expect(useMealsStore.getState().pendingCount).toBe(1)
  })

  it('treats a duplicate-key insert as already-done (idempotent re-flush)', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn().mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint "meals_pkey"' } })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite)).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it('resets flushing even when AsyncStorage.getItem (readQueue) throws', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('storage exploded'))
    const insert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    // The finally block always resets `flushing` regardless of whether the underlying
    // storage error is rethrown to the caller.
    await expect(useMealsStore.getState().flushQueue()).rejects.toThrow('storage exploded')

    expect(useMealsStore.getState().flushing).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not run a second concurrent flush', async () => {
    useMealsStore.setState({ flushing: true })
    const insert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })
    await useMealsStore.getState().flushQueue()
    expect(insert).not.toHaveBeenCalled()
  })

  it('a flaky reconnect that drops the connection mid-flush does not lose the un-drained meals', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
      { id: 'b', user_id: 'u1', meal_type: 'dinner', description: 'b', total_calories: 2, protein_g: 2, carbs_g: 2, fat_g: 2, fiber_g: 0, queued_at: 't2' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn()
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error('Network request failed'))
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    // 'a' was confirmed inserted and removed; 'b' dropped mid-flush and must remain queued.
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite).map((m: { id: string }) => m.id)).toEqual(['b'])
    expect(useMealsStore.getState().pendingCount).toBe(1)

    // A second flush attempt (simulating reconnect) must not re-insert 'a' and must finish 'b'.
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(lastWrite)
    const insert2 = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert: insert2 })
    await useMealsStore.getState().flushQueue()
    expect(insert2).toHaveBeenCalledTimes(1)
    expect((insert2.mock.calls[0][0] as { id: string }).id).toBe('b')
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it('keeps a queued meal with a photo queued (not inserted) when the photo upload fails', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, photo_local_uri: 'file:///a.jpg', queued_at: 't1' },
      { id: 'b', user_id: 'u1', meal_type: 'dinner', description: 'b', total_calories: 2, protein_g: 2, carbs_g: 2, fat_g: 2, fiber_g: 0, queued_at: 't2' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const upload = jest.fn().mockResolvedValue({ error: { message: 'storage down' } })
    const getPublicUrl = jest.fn()
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ upload, getPublicUrl })
    const insert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    // The photo failed to upload, so 'a' must NOT be inserted (no meal with a broken/missing
    // photo silently inserted) and must remain queued; the drain stops so 'b' (behind it) is
    // untouched too — nothing was removed from AsyncStorage.
    expect(insert).not.toHaveBeenCalled()
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    expect(useMealsStore.getState().pendingCount).toBe(2)
  })

  it('uploads a queued photo then inserts with the resulting path', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, photo_local_uri: 'file:///a.jpg', queued_at: 't1' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const upload = jest.fn().mockResolvedValue({ error: null })
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/a.jpg' } })
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ upload, getPublicUrl })
    const insert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    expect(upload).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledTimes(1)
    expect((insert.mock.calls[0][0] as { photo_url: string }).photo_url).toBe('https://cdn/a.jpg')
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it('persists the uploaded photo_url (clearing the local URI) before attempting the insert, so a crash right after upload never causes a re-upload on retry', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, photo_local_uri: 'file:///a.jpg', queued_at: 't1' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const upload = jest.fn().mockResolvedValue({ error: null })
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/a.jpg' } })
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ upload, getPublicUrl })
    const insert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    // The photo-uploaded persist (setItem) must happen strictly before the insert call —
    // that's what makes a crash between "photo uploaded" and "meal removed" safe to retry
    // without re-uploading.
    const firstSetItemOrder = (AsyncStorage.setItem as jest.Mock).mock.invocationCallOrder[0]
    const insertOrder = insert.mock.invocationCallOrder[0]
    expect(firstSetItemOrder).toBeLessThan(insertOrder)
    // And that persisted intermediate write must carry the remote photo_url with no local URI.
    const firstWrite = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])
    expect(firstWrite[0].photo_url).toBe('https://cdn/a.jpg')
    expect(firstWrite[0].photo_local_uri).toBeUndefined()
  })

  it('a crash-recovered queued item (photo already uploaded, local URI cleared) is drained via duplicate-key success without re-uploading', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, photo_url: 'https://cdn/a.jpg', queued_at: 't1' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const upload = jest.fn()
    const getPublicUrl = jest.fn()
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ upload, getPublicUrl })
    const insert = jest.fn().mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint "meals_pkey"' } })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    expect(upload).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledTimes(1)
    expect((insert.mock.calls[0][0] as { photo_url: string }).photo_url).toBe('https://cdn/a.jpg')
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite)).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it("caches today's meals on the device and keeps them when a refresh fails (offline)", async () => {
    const day = new Date().toISOString().split('T')[0]
    const ok = { select: jest.fn(), eq: jest.fn(), gte: jest.fn(), order: jest.fn() }
    ok.select.mockReturnValue(ok); ok.eq.mockReturnValue(ok); ok.gte.mockReturnValue(ok)
    ok.order.mockResolvedValue({ data: [{ id: 'm1' }], error: null })
    ;(supabase.from as jest.Mock).mockReturnValue(ok)
    await useMealsStore.getState().fetchTodayMeals('u1')

    const { cacheStorage } = require('../../lib/cacheStorage')
    const cached = cacheStorage.getItem('poshan.cache.meals')
    expect(cached.state).toEqual({ meals: [{ id: 'm1' }], mealsDay: day })

    ok.order.mockResolvedValue({ data: null, error: { message: 'TypeError: Network request failed' } })
    await useMealsStore.getState().fetchTodayMeals('u1')
    expect(useMealsStore.getState().meals).toEqual([{ id: 'm1' }])
    expect(useMealsStore.getState().error).toMatch(/network/i)
  })
})
