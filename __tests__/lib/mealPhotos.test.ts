import { uploadMealPhoto } from '../../lib/api/mealPhotos'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }))
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('aGVsbG8='),
  EncodingType: { Base64: 'base64' },
}))

describe('uploadMealPhoto', () => {
  it("uploads into the user's folder of the private bucket and returns the storage path", async () => {
    const upload = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ upload })
    const path = await uploadMealPhoto('u1', 'file:///photo.jpg')
    expect(supabase.storage.from).toHaveBeenCalledWith('meal-photos')
    expect(path).toMatch(/^u1\/\d+\.jpg$/)
    expect(upload.mock.calls[0][0]).toBe(path)
    expect(upload.mock.calls[0][2]).toEqual({ contentType: 'image/jpeg', upsert: false })
  })

  it('throws a readable error when the upload fails', async () => {
    ;(supabase.storage.from as jest.Mock).mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: { message: 'quota' } }) })
    await expect(uploadMealPhoto('u1', 'file:///photo.jpg')).rejects.toThrow("Couldn't upload the photo: quota")
  })
})
