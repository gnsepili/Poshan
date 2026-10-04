import { supabase } from './supabase'

export type PhotoBucket = 'meal-photos' | 'inbody-photos'

const TTL_SECONDS = 3600
// Re-sign a little before expiry so an image never loads with a just-expired link.
const REUSE_MS = (TTL_SECONDS - 300) * 1000

const cache = new Map<string, { url: string; expiresAt: number }>()

// Photo buckets are private: rows store the object path ("<userId>/<file>.jpg"). Older
// meal rows stored a (non-working) public URL, so accept any URL containing the path too.
export function storagePath(bucket: PhotoBucket, pathOrUrl: string): string {
  const marker = `/${bucket}/`
  if (!pathOrUrl.includes(marker)) return pathOrUrl
  return pathOrUrl.split(marker)[1].split('?')[0]
}

// A short-lived URL the <Image> can load, or null if the photo can't be accessed.
export async function getSignedPhotoUrl(bucket: PhotoBucket, pathOrUrl: string): Promise<string | null> {
  if (pathOrUrl.startsWith('file:')) return pathOrUrl
  const path = storagePath(bucket, pathOrUrl)
  const key = `${bucket}/${path}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + REUSE_MS })
  return data.signedUrl
}

export function clearSignedPhotoCache(): void {
  cache.clear()
}
