import { storagePath, getSignedPhotoUrl, clearSignedPhotoCache } from '../../lib/signedPhotos'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }))

describe('storagePath', () => {
  it('extracts the object path from public and signed URLs', () => {
    expect(storagePath('meal-photos', 'https://x.supabase.co/storage/v1/object/public/meal-photos/u1/1.jpg')).toBe('u1/1.jpg')
    expect(storagePath('meal-photos', 'https://x.supabase.co/storage/v1/object/sign/meal-photos/u1/1.jpg?token=abc')).toBe('u1/1.jpg')
  })
  it('passes a bare path through', () => {
    expect(storagePath('meal-photos', 'u1/1.jpg')).toBe('u1/1.jpg')
  })
})

describe('getSignedPhotoUrl', () => {
  const createSignedUrl = jest.fn()
  beforeEach(() => {
    clearSignedPhotoCache()
    createSignedUrl.mockReset()
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ createSignedUrl })
  })

  it('signs the path (from a legacy public URL) and caches the result', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/1' }, error: null })
    const url = 'https://x.supabase.co/storage/v1/object/public/meal-photos/u1/1.jpg'
    await expect(getSignedPhotoUrl('meal-photos', url)).resolves.toBe('https://signed/1')
    await expect(getSignedPhotoUrl('meal-photos', 'u1/1.jpg')).resolves.toBe('https://signed/1')
    expect(createSignedUrl).toHaveBeenCalledTimes(1)
    expect(createSignedUrl).toHaveBeenCalledWith('u1/1.jpg', 3600)
  })

  it('returns local file URIs (offline-queued photos) unchanged', async () => {
    await expect(getSignedPhotoUrl('meal-photos', 'file:///tmp/1.jpg')).resolves.toBe('file:///tmp/1.jpg')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns null (no photo) when signing fails, without caching the failure', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    await expect(getSignedPhotoUrl('meal-photos', 'u1/2.jpg')).resolves.toBeNull()
    createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: 'https://signed/2' }, error: null })
    await expect(getSignedPhotoUrl('meal-photos', 'u1/2.jpg')).resolves.toBe('https://signed/2')
  })
})
