/**
 * Resolve a same-origin URL suitable for useGLTF / GLTFLoader.
 * WebGL cannot load cross-origin storage URLs without CORS — proxy via /api/files/model.
 */

export interface ProductModelFields {
  modelUrl?: string | null
  modelStorageKey?: string | null
}

/** Recover object key from a MinIO/S3 signed URL path (`/bucket/skus/models/….glb`). */
export function storageKeyFromSignedUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const key = parts.slice(1).join('/')
    if (!key || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

/**
 * Stable identity for a file so 500 SKUs that share one GLB (each with a
 * different presigned URL) hit the same cache and the same `/api/files/model` call.
 */
export function canonicalFileCacheKey(src: string): string {
  const t = src.trim()
  if (!t) return t
  try {
    if (t.startsWith('/api/files/')) {
      const u = new URL(t, 'http://local.invalid')
      const key = u.searchParams.get('key')
      if (key) return key
      const nested = u.searchParams.get('url')
      if (nested) return storageKeyFromSignedUrl(nested) ?? nested.split('?')[0]
    }
    if (/^https?:\/\//i.test(t)) {
      return storageKeyFromSignedUrl(t) ?? t.split('?')[0]
    }
  } catch {
    /* ignore */
  }
  if (!t.startsWith('/') && !/^https?:\/\//i.test(t) && !t.includes('..')) return t
  return t.split('?')[0]
}

function storageKeyFromAnyRef(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('/') && !/^https?:\/\//i.test(t) && !t.includes('..')) return t
  const key = canonicalFileCacheKey(t)
  if (key && !key.startsWith('/') && !/^https?:\/\//i.test(key)) return key
  return storageKeyFromSignedUrl(t)
}

export function resolveProductModelUrl(fields: ProductModelFields): string | null {
  const rawUrl = typeof fields.modelUrl === 'string' ? fields.modelUrl.trim() : ''
  const explicitKey =
    typeof fields.modelStorageKey === 'string' ? fields.modelStorageKey.trim() : ''
  const key = explicitKey || (rawUrl ? storageKeyFromAnyRef(rawUrl) : '') || ''

  // Prefer storage key — one proxy URL for every SKU that shares the file.
  if (key) {
    return `/api/files/model?key=${encodeURIComponent(key)}`
  }

  if (rawUrl) {
    if (rawUrl.startsWith('/')) return rawUrl
    if (/^https?:\/\//i.test(rawUrl)) {
      return `/api/files/model?url=${encodeURIComponent(rawUrl)}`
    }
    return rawUrl
  }

  return null
}

export function isGlbPath(path: string): boolean {
  return /\.glb$/i.test(path) || path.includes('model/gltf')
}
