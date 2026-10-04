import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../supabase'

// Upload a captured meal photo to the user's folder in the private meal-photos bucket.
// Returns the storage path (shown later via signed URLs).
export async function uploadMealPhoto(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 })
  const { error } = await supabase.storage
    .from('meal-photos')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`Couldn't upload the photo: ${error.message}`)
  return path
}
