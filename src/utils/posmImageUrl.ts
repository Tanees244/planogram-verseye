/** Resolve a same-origin proxy URL for POSM / catalog images (WebGL-safe). */
export function resolvePosmImageUrl(fields: {
  imageUrl?: string | null
  imageStorageKey?: string | null
}): string | null {
  const rawUrl = fields.imageUrl?.trim()
  if (rawUrl) {
    if (/^https?:\/\//i.test(rawUrl)) {
      return `/api/files/image?url=${encodeURIComponent(rawUrl)}`
    }
    if (rawUrl.startsWith('/')) return rawUrl
  }
  const key = fields.imageStorageKey?.trim()
  if (key) {
    return `/api/files/image?key=${encodeURIComponent(key)}`
  }
  return null
}
