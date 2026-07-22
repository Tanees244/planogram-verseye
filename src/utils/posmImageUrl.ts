/** Try to recover an object storage key from a MinIO/S3 signed URL path. */
function storageKeyFromSignedUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname // /aisleris-bucket/posm/....png
    const parts = path.split('/').filter(Boolean)
    // [bucket, ...keySegments]
    if (parts.length < 2) return null
    const key = parts.slice(1).join('/')
    if (!key || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

/** Resolve a same-origin proxy URL for POSM / catalog images (WebGL-safe). */
export function resolvePosmImageUrl(fields: {
  imageUrl?: string | null
  imageUrls?: string[] | null
  imageStorageKey?: string | null
}): string | null {
  // Prefer storage key — shorter URL, re-presigned by proxy, no expiry issues.
  const key = fields.imageStorageKey?.trim()
  if (key) {
    return `/api/files/image?key=${encodeURIComponent(key)}`
  }

  const fromArray = Array.isArray(fields.imageUrls)
    ? fields.imageUrls.find((u) => typeof u === 'string' && u.trim())
    : null
  const rawUrl = (fields.imageUrl?.trim() || fromArray?.trim()) ?? ''
  if (rawUrl) {
    if (/^https?:\/\//i.test(rawUrl)) {
      // Prefer key extracted from path over embedding the full signed URL
      // (long query strings break WebGL TextureLoader / useTexture).
      const inferred = storageKeyFromSignedUrl(rawUrl)
      if (inferred) {
        return `/api/files/image?key=${encodeURIComponent(inferred)}`
      }
      return `/api/files/image?url=${encodeURIComponent(rawUrl)}`
    }
    if (rawUrl.startsWith('/')) return rawUrl
  }
  return null
}

