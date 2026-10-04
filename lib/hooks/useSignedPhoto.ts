import { useEffect, useState } from 'react'
import { getSignedPhotoUrl, PhotoBucket } from '../signedPhotos'

// Resolves a stored photo path to a loadable URL (null while loading or if unavailable).
export function useSignedPhoto(bucket: PhotoBucket, pathOrUrl: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (!pathOrUrl) return
    let cancelled = false
    getSignedPhotoUrl(bucket, pathOrUrl)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [bucket, pathOrUrl])
  return url
}
